# Palworld Breeding API

Read-only Cloudflare-Worker-API für schnelle, reproduzierbare Palworld-Zuchtberechnungen. Der Worker verwendet ausschließlich beim Build erzeugte Repository-Daten und ruft zur Laufzeit weder GitHub noch externe Zuchtrechner auf.

## Aktuelle Zugriffswege

Der Worker stellt dieselbe kanonische Resolverlogik auf zwei Wegen bereit:

1. **Öffentliches MCP:** anonymer Streamable-HTTP-Endpunkt `/mcp`.
2. **Geschützte REST-API:** bestehender kompatibler Read-only-Zugang; konkreter Pfad wird absichtlich nicht dokumentiert.

Der MCP-Endpunkt delegiert intern an die vorhandenen REST-Route-Handler. Es gibt keine zweite Zuchtimplementierung und keine abweichende Datenquelle.

Das öffentliche MCP bietet genau diese fünf read-only Tools:

- `breeding_status`
- `breeding_pair`
- `breeding_parents`
- `breeding_children`
- `breeding_route`

Alle fünf Tools sind als read-only, nicht destruktiv und idempotent beschrieben. Das öffentliche MCP enthält keine Token-, Verwaltungs-, Schreib- oder Deploymentfunktionen.

Der öffentliche MCP-Zugang wurde am 13.07.2026 aus ChatGPT über die verbundene App **Breeder** erfolgreich geprüft. Das ist ein historischer Integrationstest und keine dauerhafte Aussage über die aktuelle Erreichbarkeit. Die konkrete Worker-Basisadresse und der geschützte REST-Zugangsschlüssel werden absichtlich nicht in diesem öffentlichen Repository gespeichert.

`breeding_status` bleibt als leichtgewichtiger technischer Statusaufruf erhalten. Er liest nur die bereits deployten Referenzmetadaten und führt keine externe Patch-, Web- oder GitHub-Recherche aus. Er ist für Wartung, Diagnostik, Deploymentkontrolle und geplante Integritätsprüfungen gedacht, aber nicht als verpflichtende Routineabfrage vor jeder normalen Zuchtanfrage.

## Fachlicher Stand

Die Referenz enthält weiterhin den historischen Palworld-1.0-Artenbestand vom 13.07.2026. Ihre Schema-5-Mechanik ist strukturell validiert; die vollständige buildgenaue Migration auf den aktuellen offiziellen Dedicated Server ist noch nicht freigegeben. Zwei direkt erzeugte und ausgebrütete Eier bestätigen:

- `Lunaris MALE + Grintale FEMALE → Penking`
- `Sibelyx + Lamball → Surfent`

Daraus gelten global:

1. Gleiche Art ergibt zuerst wieder dieselbe Art.
2. Danach gelten direkte Spezialkombinationen samt Geschlechtsvorgaben.
3. Spezialkinder, also alle Arten aus `special_combinations.child_internal`, sind keine normalen Formel-Kandidaten. Ihre Same-Species-Zucht und Spezialkombinationen bleiben gültig.
4. Der normale Pool verlangt `CombiRank > 0`, `IgnoreCombi = false` und keine Spezialkind-Art.
5. Bei gleichem Rank-Abstand gewinnt die höhere `CombiDuplicatePriority`; Seltenheit ist kein Zucht-Tie-Breaker.
6. Danach entscheiden Nicht-Variante und interne Reihenfolge.
7. Paldeck-Nummern beeinflussen weder Zuchtwert noch Tie-Break.

Palworld.gg wurde für die beiden Testfälle ausschließlich manuell und nicht-kanonisch gegengeprüft. Es ist keine Build-, Release- oder Runtime-Abhängigkeit.

Die strukturelle Validierung ist grün und enthält keine ungelösten fachlichen Konflikte. Das Release-Gate bleibt absichtlich blockiert, solange `manifest.patch_check.status` nicht nach dem aktuellen Core-Import auf `current` gesetzt werden kann.

## Kanonische Quellen und Zähler

Verbindliche Lesereihenfolge:

1. `../../data/palworld-breeding/breeding_rules.json`
2. `../../data/palworld-breeding/special_combinations.json`
3. `../../data/palworld-breeding/pal_values.json`
4. `../../data/palworld-breeding/manifest.json`

Aktueller dokumentierter Stand:

- kanonisches Schema: 5
- API-/Artefaktschema: 2
- Pals: 299
- Spezialkombinationen: 136
- eindeutige Spezialkind-Arten: 90
- zulässige normale Formel-Kinder: 184 statt zuvor 261
- ungeordnete Artenpaare einschließlich Same-Species: 44.850
- durch die Spezialkindregel geänderte Paarergebnisse: 13.479
- `source_data_hash`: `0e42421242027cdc6516b8f140d6fe1c0b94d6e9201164554a9337259bc21636`
- `generated_artifact_hash`: `6189863ff6b8878bf2a6997064eb9a4e7455b306815d1173430427f9530bbee1`

`source_data_hash` hasht deterministisch die vier kanonischen Eingabedateien. `generated_artifact_hash` hasht den kanonisch serialisierten generierten Referenzinhalt, wobei seine eigenen Hashfelder ausgeschlossen werden. Beide Begriffe werden öffentlich nicht vermischt.

Der vollständige Policyvergleich steht in `generated/special-child-impact.json`. Die separate Bestandsanalyse unter `../../data/palworld-breeding/analysis/anubis_jolthog_route.json` ist ebenfalls auf Schema 5 aktualisiert.

## Bekannte Routenänderungen

- `Sibelyx + Lamball`: Gobfin Ignis → **Surfent**
- `Anubis + Eikthyrdeer Terra`: Kingpaca Cryst → **Bakemi**
- `Anubis + Panthalus`: Dualith Noct → **Knocklem**
- `Dualith Noct + Jolthog`: Elphidran Aqua → **Vanwyrm**
- `Kingpaca Cryst + Jolthog → Elphidran` bleibt gültig.
- `Elphidran + Surfent → Elphidran Aqua` bleibt als Spezialkombination gültig.

Die frühere direkte Zweistufen-Abkürzung vom schmutzigen Anubis über einen beliebigen blanken Mate und anschließend den festen Jolthog liefert unter Schema 5 keinen Elphidran, Surfent oder Elphidran Aqua. Längere Routen bleiben möglich.

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

Der geschützte REST-Zugang bleibt für bestehende technische Integrationen kompatibel. Basisadresse, konkreter geschützter Pfad und geheime Werte werden absichtlich nicht in diesem öffentlichen Repository ausgeschrieben.

Fehlende oder ungültige Authentifizierung liefert eine neutrale HTTP-404-Antwort. Unterstützt werden `GET`, `HEAD` und notwendige `OPTIONS`; schreibende Methoden sind nicht vorgesehen.

Antworten verwenden JSON, ETag, Cache-Control, `nosniff`, `noindex` und CORS für die nicht vertraulichen Read-only-Daten.

Unterstützte Read-only-Funktionen:

- kompakter Schema-, Hash-, Zähler-, Patch- und Validierungsstatus
- deutsche, englische und interne Namensauflösung
- direkte Paarung samt Regel, Kandidaten und Tie-Break
- Elternorientierungen eines Ziel-Pals
- zweite Eltern und Kinder eines Trägers
- theoretisch kürzeste Artenrouten
- vollständige maschinenlesbare Referenz
- Validierung, beide Hasharten, Patchcheck und Impact-Zusammenfassung

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

`/pal`, `/reference` und `/validate` sind bewusst nicht als öffentliche MCP-Tools exponiert. Status- und Validierungsinformationen, die für Wartung und Diagnose nötig sind, werden über `breeding_status` geliefert.

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

`manifest.patch_check` nennt Version `1.0`, Prüftag `2026-07-13`, Status `needs_review`, keine verifizierte Buildnummer und `requires_recheck_after_newer_patch = true`. Erst ein vollständig geprüfter Import des aktuellen offiziellen Builds darf den Status wieder auf `current` setzen.

## CI und Deployment

`Breeding API CI` installiert mit `--frozen-lockfile`, validiert die bestehende Root-PWA, generiert beide Artefakte, prüft auf nicht committete Generated-Abweichungen, lintet, typprüft, testet, baut den Worker trocken, validiert strukturell und für Release, prüft Determinismus und scannt Secrets. Der Secretscan erfasst neben den unterstützten Textformaten ausdrücklich auch lokale Umgebungsdateien nach den Mustern `.env`, `.env.*`, `.dev.vars` und `.dev.vars.*`; passende Ignore-Regeln schützen diese Dateien zusätzlich vor versehentlichem Committen. Feature-Branches deployen nicht.

Der PR-Head des öffentlichen MCP-Ausbaus wurde am 13.07.2026 erfolgreich durch `Breeding API CI` und die Root-PWA-Validierung geprüft.

Temporäre schreibende Migrations-, Probe- und Generated-Refresh-Workflows des Feature-Branches sind entfernt. Kanonische Daten und generierte Artefakte werden reviewbar gemeinsam committed; CI besitzt nur Leserechte.

`Deploy Breeding API` ist manuell, nur auf `main`, verwendet das GitHub-Environment `production`, wiederholt die gesamte Freigabekette und deployt erst danach mit `pnpm exec wrangler deploy --keep-vars`. Dadurch bleibt das vorhandene Worker-Secret erhalten.

## Grenzen, private Projektdaten und Rollback

Die API verwaltet keinen Nutzerbestand und modelliert keine Passive-Chancen, IVs, Mutationen, Eier-, Kuchen- oder Zeitkosten. Ein theoretisch kürzester Artenweg kann praktisch schlechter sein als eine längere saubere Linie.

Persönliche Pal-Bestände, individuelle Ziel-Pals, laufende private Zuchtprojekte, ChatGPT-Projektanweisungen und Backup-Pakete gehören bewusst nicht in den öffentlichen Breeder oder dieses öffentliche Repository. Sie dürfen nur auf ausdrücklichen Wunsch in einer getrennten privaten Quelle oder einem privaten Repository gespeichert werden.

Cloudflare-Rollback erfolgt über die letzte gute Worker-Version. Repository-Rollback erfolgt mit einem normalen `git revert`, danach vollständiger CI- und Release-Prüfung; kein Hard Reset und keine isolierte Rücksetzung kanonischer Daten ohne Manifest-/Patchabgleich.

## Dauerhafte technische Übergabe

Nach materiellen Änderungen an Daten, API, MCP, CI oder Deployment muss `HANDOFF_CHATGPT.md` im selben Arbeitsgang aktualisiert werden. Der Handoff speichert technische Entscheidungen, aktuellen dokumentierten Stand, Validierung und offene technische Schritte, aber niemals persönliche Chatverläufe, Spielerbestände, private Backups, Zugangsschlüssel, geheime Werte oder authentifizierte URLs.
