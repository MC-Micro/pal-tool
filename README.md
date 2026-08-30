# Pal Tool

`MC-Micro/pal-tool` ist die öffentliche technische Wahrheit für allgemeine Palworld-Spieldaten und die darauf aufbauenden Werkzeuge.

Der laufende Core-Refresh erweitert das Repository von den bisherigen Passiven-/Breeder-Bausteinen zu einer gemeinsamen, GitHub-nativen Pal Data Core Architektur.

## Aktive Bausteine

1. installierbare **Palworld Passives PWA** im Repository-Root;
2. kanonische **Breeding-Regel- und Datenebene** unter `data/palworld-breeding/`;
3. daraus erzeugte read-only **Breeding API mit Cloudflare Worker und öffentlichem MCP** unter `services/breeding-api/`;
4. im Aufbau befindlicher **Pal Data Core** unter `data/palworld-core/`;
5. im Aufbau befindliches **GitHub-natives Data-Core-Tooling** unter `tools/pal-data-core/`.

Die Runtime-API verwendet weiterhin ausschließlich vorab erzeugte Repository-Artefakte und ruft bei einem normalen Request weder GitHub noch externe Zuchtrechner auf.

## Repository-Grenzen

- Allgemeine Palworld-Spielwahrheit, Data Core, Fachregeln und Engines: dieses Repository.
- Persönlicher Player State, IVs/Talente, konkrete Passivkombinationen und private Projekte: `MC-Micro/pal-vault`.
- Server-/Hoststeuerung: `MC-Micro/pal-control`.

`pal-tool` darf für Build, Tests oder öffentliche Runtime nicht von den privaten Repositories abhängig sein.

## Einstieg für neue Chats und Maintainer

- Repositoryweite Arbeitsregeln: [`AGENTS.md`](AGENTS.md)
- Data-Core-Zielarchitektur: [`docs/PAL_DATA_CORE_ARCHITECTURE.md`](docs/PAL_DATA_CORE_ARCHITECTURE.md)
- Private Planner-Zielarchitektur: [`docs/BREEDING_PLANNER_ARCHITECTURE.md`](docs/BREEDING_PLANNER_ARCHITECTURE.md)
- Data-Core-Datenbereich: [`data/palworld-core/README.md`](data/palworld-core/README.md)
- GitHub-native Pipeline: [`tools/pal-data-core/README.md`](tools/pal-data-core/README.md)
- Zuchtregeln und Datenstand: [`data/palworld-breeding/README.md`](data/palworld-breeding/README.md)
- API-/Worker-Dokumentation: [`services/breeding-api/README.md`](services/breeding-api/README.md)
- ChatGPT-/Codex-Handoff: [`services/breeding-api/HANDOFF_CHATGPT.md`](services/breeding-api/HANDOFF_CHATGPT.md)

Chatverläufe sind kein dauerhafter Projektspeicher. Materielle Entscheidungen, Architekturänderungen, Validierungsergebnisse, Deploymentfolgen und offene Restschritte müssen in den passenden getrackten Dateien aktualisiert werden. Persönliche Gesprächsinhalte, Tokens, Zugangsdaten und authentifizierte URLs gehören nicht ins Repository.

## Repository-Struktur

```text
.
├── index.html, app.js, app.css
├── data-passives.js, data-overrides.js
├── data/
│   ├── palworld-core/
│   └── palworld-breeding/
├── tools/
│   └── pal-data-core/
├── services/
│   └── breeding-api/
├── docs/
├── scripts/
├── .github/workflows/
└── AGENTS.md
```

# Pal Data Core

Der Data Core soll künftig allgemeine, buildbezogene Fakten aus einer reproduzierbaren Primärquelle bereitstellen.

Regulärer Zielweg:

```text
Steam public build id
→ offizieller Palworld Dedicated Server
→ GitHub Actions
→ CUE4Parse Probe/Snapshot
→ Technical Core
→ Diff/Validierung
→ Domain-Generatoren
→ Review
→ akzeptierte kanonische Daten
```

Der frühere lokale Windows-/Laptop-Extraktionsweg wird nicht als Standardpipeline weiterentwickelt. Raw PAKs, Mappings und vollständige Originalassets werden nicht committed.

Der Technical Core filtert nicht bereits beim Einlesen auf die öffentliche spielbare Pal-Liste. Technische Existenz, Spielbarkeit, Fangbarkeit, Züchtbarkeit und Sonderformen bleiben getrennte Eigenschaften.

Geplante Domain-Module umfassen unter anderem:

- Pal-Identitäten;
- Elemente;
- Stats;
- Arbeitstauglichkeiten;
- Movement;
- Passiven;
- Partnerfähigkeiten;
- Items und Tech;
- Breeding;
- Provenienz-/Buildmanifest.

# Palworld Passives PWA

Eine leichte, installierbare und offlinefähige Palworld-Passives-Datenbank für Breeding und Buildplanung.

## Aktueller Produktumfang

- deutsche und englische Namen;
- deutsche und englische Effekte;
- verständliche Erklärungen;
- Rang- und Statusanzeige;
- rollenabhängige Prioritäten;
- Multi-Rollen-Filter;
- Top-Passives-Sortierung;
- installierbare PWA mit Offline-Cache.

Die vorhandene PWA wird während des Data-Core-Aufbaus nicht unnötig umgebaut. Eine spätere Migration auf gemeinsame Core-Daten erfolgt kontrolliert und rückwärtskompatibel.

# Breeding-Domain

Die fachliche Regelwahrheit liegt unter `data/palworld-breeding/`.

Für den Resolver gilt weiterhin die Domain-Lesereihenfolge:

1. `breeding_rules.json`;
2. `special_combinations.json`;
3. `pal_values.json`;
4. `manifest.json`.

Während des aktuellen 1.0.3-Core-Refresh ist der Datenstand auf dem Feature-Branch **nicht als endgültig aktueller Release zu behandeln**. Das Schema wurde bereits für die neue Prioritäts-/Tie-Logik angehoben, die buildabhängigen Pal- und Spezialkombinationsdaten werden jedoch erst nach vollständiger aktueller Dedicated-Server-Revalidierung ersetzt.

Langfristig sollen `pal_values.json` und `special_combinations.json` deterministisch aus dem Pal Data Core erzeugt werden. `breeding_rules.json` bleibt die getestete Fachregelwahrheit des Resolvers.

# Breeding API und MCP

Das Modul `services/breeding-api/` baut aus der kanonischen Breeding-Domain einen deterministischen Cloudflare Worker.

Der bestehende öffentliche MCP bleibt zunächst stateless und read-only mit den fünf Tools:

- `breeding_status`;
- `breeding_pair`;
- `breeding_parents`;
- `breeding_children`;
- `breeding_route`.

Der öffentliche MCP darf keinen privaten Player State lesen oder ausgeben.

## Private Planner-Zielrichtung

Eine spätere authentifizierte Planner-Schicht soll allgemeine Breeding-/Data-Core-Daten mit einem privaten, validierten Player-State-Snapshot verbinden können. Dadurch werden bestandsoptimierte Routen mit Geschlecht, Passiven, IVs/Talenten, Varianten und vorhandenen Zwischenprodukten möglich, ohne bei jeder Anfrage zwei GitHub-Repositories live durchsuchen zu müssen.

Die kanonische private Quelle bleibt `MC-Micro/pal-vault`; ein Runtime-Snapshot wäre nur ein validiertes, versioniertes Spiegelartefakt.

Details stehen in [`docs/BREEDING_PLANNER_ARCHITECTURE.md`](docs/BREEDING_PLANNER_ARCHITECTURE.md).
