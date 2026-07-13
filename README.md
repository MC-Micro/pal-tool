# Pal Tool

Dieses Repository enthält drei bewusst getrennte Palworld-Bausteine:

1. die installierbare **Palworld Passives PWA v1.0.0** im Repository-Root,
2. die kanonische **Palworld-1.0-Zuchtreferenz** unter `data/palworld-breeding/`,
3. die daraus erzeugte read-only **Breeding API mit Cloudflare Worker, geschütztem REST-Zugang und öffentlichem MCP-Endpunkt** unter `services/breeding-api/`.

Die PWA und die Breeding API teilen keine Laufzeitlogik. Die API verwendet beim Request ausschließlich vorab erzeugte Repository-Artefakte und ruft weder GitHub noch externe Zuchtrechner auf.

## Einstieg für neue Chats und Maintainer

- Repositoryweite Arbeitsregeln: [`AGENTS.md`](AGENTS.md)
- Kanonische Zuchtregeln und Datenstand: [`data/palworld-breeding/README.md`](data/palworld-breeding/README.md)
- API-/Worker-Dokumentation: [`services/breeding-api/README.md`](services/breeding-api/README.md)
- Aktuelle Übergabe für neue ChatGPT-/Codex-Sitzungen: [`services/breeding-api/HANDOFF_CHATGPT.md`](services/breeding-api/HANDOFF_CHATGPT.md)

Chatverläufe sind kein dauerhafter Projektspeicher. Materielle Entscheidungen, Architekturänderungen, Validierungsergebnisse, Deploymentfolgen und offene Restschritte müssen in den passenden getrackten Dateien aktualisiert werden. Persönliche Gesprächsinhalte, Tokens, Zugangsdaten und authentifizierte URLs gehören nicht ins Repository.

## Repository-Struktur

```text
.
├── index.html, app.js, app.css
├── data-passives.js, data-overrides.js
├── manifest.webmanifest, sw.js
├── docs/
│   └── ROADMAP.md
├── data/
│   └── palworld-breeding/
├── services/
│   └── breeding-api/
├── scripts/
│   └── validate-data.mjs
├── .github/workflows/
└── AGENTS.md
```

# Palworld Passives PWA v1.0.0

Eine leichte, installierbare und offlinefähige Palworld-Passives-Datenbank für Breeding und Buildplanung.

## Aktueller Umfang

- 102 Passives
- deutsche und englische Namen
- deutsche und englische Effekte
- verständliche Erklärungen
- Rang- und Statusanzeige
- rollenabhängige Prioritäten
- Multi-Rollen-Filter
- Top-Passives-Sortierung
- installierbare PWA mit Offline-Cache

## Dateien

- `index.html` – Einstiegspunkt und Oberfläche
- `app.css` – responsives Layout und Design
- `app.js` – Suche, Filter, Sortierung und Kartenlogik
- `data-passives.js` – vollständige Passives-Datenbasis
- `data-overrides.js` – geprüfte Korrekturen und stabile v1.0.0-Metadaten
- `manifest.webmanifest` – Installationsdaten der PWA
- `sw.js` – Offline-Cache
- `icon-192.png` und `icon-512.png` – App-Icons
- `scripts/validate-data.mjs` – automatische Daten- und Strukturprüfung
- `.github/workflows/validate.yml` – GitHub-Actions-Validierung
- `docs/ROADMAP.md` – Ausbauplan für Pals, Partnerfähigkeiten, Favoriten und Buildplanung

## Nutzung

Die veröffentlichte GitHub-Pages-Seite kann in Chrome oder Safari geöffnet und über „App installieren“ beziehungsweise „Zum Home-Bildschirm“ als PWA installiert werden.

Nach dem ersten vollständigen Laden funktioniert die App auch offline. Bei einer neuen App-Version sollte der Cache-Name in `sw.js` erhöht werden.

## Entwicklung

Die PWA verwendet bewusst keine Frameworks, Paketmanager oder externen Laufzeitabhängigkeiten. Sie besteht aus HTML, CSS und Vanilla JavaScript.

Lokale Prüfung:

```bash
node scripts/validate-data.mjs
```

Die gleiche Prüfung läuft automatisch bei Pushes und Pull Requests über GitHub Actions.

## Datenregeln

- keine erfundenen Prozentwerte
- deutsche Ingame-Namen müssen korrekt sein
- Rollenprioritäten gelten nur für den jeweiligen Einsatzbereich
- Tradeoff-Traits dürfen positive und negative Rollenbewertungen gleichzeitig besitzen
- reine Negativtraits werden separat unter `Negativ / Meiden` geführt
- echte Spieländerungen werden als `Geändert` markiert
- Korrekturen zuvor falscher Tool-Daten werden als `Korrigiert` markiert
- Quellen werden für Recherche und Wartung genutzt, aber nicht in der App-Oberfläche angezeigt

## Nächste Ausbaustufe

Die PWA soll später um Pal-Daten, Partnerfähigkeiten mit Stufenwerten, Favoriten und einen Build-Planer erweitert werden. Die geplante Architektur steht in [`docs/ROADMAP.md`](docs/ROADMAP.md).

# Kanonische Zuchtreferenz

Die verbindlichen Zuchtdaten liegen unter `data/palworld-breeding/`. Für konkrete Berechnungen gilt diese Lesereihenfolge:

1. `breeding_rules.json`
2. `special_combinations.json`
3. `pal_values.json`
4. `manifest.json`

Der aktuelle Schema-4-Stand umfasst 299 Pals, 136 direkte Spezialkombinationen und 184 zulässige normale Formel-Kinder. Patchstatus, Quellen-Pins, Hashes, Zähler und bekannte Restunsicherheiten stehen im Manifest. Generierte API-Dateien sind abgeleitete Artefakte und niemals die kanonische Datenquelle.

# Breeding API und MCP

Das Modul `services/breeding-api/` baut aus der kanonischen Referenz einen deterministischen Cloudflare Worker.

Es gibt zwei getrennte Zugriffswege auf dieselbe read-only Resolverlogik:

- **Öffentliches MCP:** anonymer Streamable-HTTP-Endpunkt `/mcp` mit genau fünf Tools: `breeding_status`, `breeding_pair`, `breeding_parents`, `breeding_children` und `breeding_route`.
- **Geschützte REST-API:** `/<BREEDING_READ_TOKEN>/v1/...`; der Token ist ausschließlich ein Cloudflare-Worker-Secret und wird nicht committed oder in dieser Dokumentation ausgeschrieben.

Der MCP-Zugang führt intern die bestehenden REST-Route-Handler aus. Es existiert keine zweite oder abweichende Zuchtimplementierung. Alle MCP-Tools sind read-only, nicht destruktiv und greifen nur auf die gebauten Referenzartefakte zu.

Details zu Endpunkten, Toolgrenzen, Tests, CI, Deployment und Rollback stehen in [`services/breeding-api/README.md`](services/breeding-api/README.md).
