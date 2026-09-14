# Pal Tool

`MC-Micro/pal-tool` ist die öffentliche technische Wahrheit für allgemeine Palworld-Spieldaten und die darauf aufbauenden Werkzeuge.

Der laufende Core-Refresh erweitert das Repository von den bisherigen Passiven-/Breeder-Bausteinen zu einer gemeinsamen, GitHub-nativen Pal Data Core Architektur.

## Aktive und geplante Bausteine

1. installierbare **Palworld Passives PWA** im Repository-Root;
2. kanonische **Breeding-Regel- und Datenebene** unter `data/palworld-breeding/`;
3. daraus erzeugte read-only **Breeding API mit Cloudflare Worker und öffentlichem MCP** unter `services/breeding-api/`;
4. im Aufbau befindlicher **Pal Data Core** unter `data/palworld-core/`;
5. im Aufbau befindliches **GitHub-natives Data-Core-Tooling** unter `tools/pal-data-core/`;
6. als Zielarchitektur dokumentierte private **Breeder AI PWA mit Multi-User Inventory und bestandsoptimiertem Planner**.

Die Runtime-API verwendet weiterhin ausschließlich vorab erzeugte Repository-Artefakte und ruft bei einem normalen Request weder GitHub noch externe Zuchtrechner auf.

Die Breeder AI PWA ist zum aktuellen Stand nur geplant. Es existieren daraus noch keine neue Runtime, Datenbank, Access-Policy, API, MCP-Funktion oder Deploymentfolge.

## Repository-Grenzen

- Allgemeine Palworld-Spielwahrheit, Data Core, Fachregeln und Engines: dieses Repository.
- Persönlicher Multi-User-Runtime-State der geplanten PWA: ausschließlich authentifizierte private Runtime-Persistenz; niemals Commit in dieses öffentliche Repository.
- Ausdrücklich im Vault gespeicherte persönliche Projekte und Kontinuität: `MC-Micro/pal-vault`.
- Server-/Hoststeuerung: `MC-Micro/pal-control`.

`pal-tool` darf für Build, Tests oder öffentliche Runtime nicht von den privaten Repositories abhängig sein. Die geplante Friends-&-Family-PWA darf insbesondere nicht voraussetzen, dass jeder Nutzer einen eigenen Vault-Bereich oder eine Git-Datei besitzt.

## Einstieg für neue Chats und Maintainer

- Repositoryweite Arbeitsregeln: [`AGENTS.md`](AGENTS.md)
- **Aktuelle Breeder-AI-Entscheidungswahrheit:** [`docs/BREEDER_AI_CURRENT_BLUEPRINT.md`](docs/BREEDER_AI_CURRENT_BLUEPRINT.md)
- **Breeder-AI-Implementierungsfahrplan/Handoff:** [`docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`](docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md)
- **Breeder-AI-Capability-Index:** [`docs/BREEDER_AI_CAPABILITY_INDEX.md`](docs/BREEDER_AI_CAPABILITY_INDEX.md)
- Multi-User-/Sprach-/PWA-Detailarchitektur: [`docs/BREEDER_AI_PWA_ARCHITECTURE.md`](docs/BREEDER_AI_PWA_ARCHITECTURE.md)
- Fachliche Planner-Zielarchitektur: [`docs/BREEDING_PLANNER_ARCHITECTURE.md`](docs/BREEDING_PLANNER_ARCHITECTURE.md)
- Social-/Server-/Freigabe-Zukunftsarchitektur: [`docs/BREEDER_AI_SOCIAL_ARCHITECTURE.md`](docs/BREEDER_AI_SOCIAL_ARCHITECTURE.md)
- Data-Core-Zielarchitektur: [`docs/PAL_DATA_CORE_ARCHITECTURE.md`](docs/PAL_DATA_CORE_ARCHITECTURE.md)
- Data-Core-Datenbereich: [`data/palworld-core/README.md`](data/palworld-core/README.md)
- GitHub-native Pipeline: [`tools/pal-data-core/README.md`](tools/pal-data-core/README.md)
- Zuchtregeln und Datenstand: [`data/palworld-breeding/README.md`](data/palworld-breeding/README.md)
- API-/Worker-Dokumentation: [`services/breeding-api/README.md`](services/breeding-api/README.md)
- ChatGPT-/Codex-Handoff: [`services/breeding-api/HANDOFF_CHATGPT.md`](services/breeding-api/HANDOFF_CHATGPT.md)

Für die geplante Breeder AI PWA ist bei widersprüchlichen älteren Konzeptpassagen zuerst `BREEDER_AI_CURRENT_BLUEPRINT.md` zu lesen. Der Implementierungsfahrplan definiert danach Phasen, Gates, Stopppunkte und Testanforderungen. Der Capability-Index verweist auf spezialisierte Species-/Mobility- und Pal-Modification-Domains.

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

Der veröffentlichte 1.0.3-Stand wurde gegen den offiziellen Dedicated-Server-Build revalidiert. Bei einem neueren Palworld-Build ist vor einer erneuten `current`-Kennzeichnung wieder ein Candidate, deterministischer Vergleich und explizites Review erforderlich.

Langfristig sollen `pal_values.json` und `special_combinations.json` deterministisch aus dem Pal Data Core erzeugt werden. `breeding_rules.json` bleibt die getestete Fachregelwahrheit des Resolvers.

# Breeding API und MCP

Das Modul `services/breeding-api/` baut aus der kanonischen Breeding-Domain einen deterministischen Cloudflare Worker.

Der bestehende öffentliche MCP bleibt stateless und read-only mit den fünf Tools:

- `breeding_status`;
- `breeding_pair`;
- `breeding_parents`;
- `breeding_children`;
- `breeding_route`.

Der öffentliche MCP darf keinen privaten Player State lesen oder ausgeben und erhält keine schreibenden Funktionen.

# Breeder AI PWA und bestandsoptimierter Planner

Die geplante Breeder AI PWA ergänzt den Breeder um eine private, geräteübergreifende Multi-User-Oberfläche für Friends-&-Family-Nutzung.

Zielrichtung:

- Chat-artige PWA für Handy, Tablet, Laptop und PC;
- Text und Sprache;
- deutsche und englische Entity-Auflösung;
- aktives Reasoning-Modell für Intent, Rückfragen, Abwägung und Erklärung;
- pro Nutzer und Spielkontext isolierter serverseitiger Bestand;
- stabile interne User-ID unabhängig von E-Mail, Nickname oder Gerät;
- vorbereitete `play_space_id` für mehrere Server/Welten;
- keine eigene Passwortdatenbank, zunächst geplanter externer Identity-/OTP-Weg;
- wertvolle konkrete Pals mit Geschlecht, Passiven, IVs/Talenten, Varianten, Sterne/Kondensation, Erweckung und Keeper-Flag;
- neutraler Bulk-/Kopienpool für nicht individuell gepflegte Massenkopien;
- typisierte, validierte Actions statt globaler Autosave-Logik oder direkter LLM-Schreibrechte;
- Project-Graph mit Checkpoints und Verzweigungen statt vollständiger Chat-History;
- Trace IDs, Mutation Log, Revisionen, Idempotency und Feedback-/Improvement-Signale;
- inventory-aware Breeding Planner;
- Kondensations-/Sterneplanner;
- Provider-Abstraktion für Speech-to-Text, Reasoning und spätere Research-Provider;
- optionaler, vom Kern getrennter Social-/Showcase-Bereich in späteren Phasen.

Die Verantwortung bleibt getrennt:

```text
Breeder / Data Core = Was ist fachlich wahr und züchterisch möglich?
Inventory / Projects = Was besitzt dieser Nutzer und woran arbeitet er?
Planner = Welche realen Routen passen praktisch zum validierten Zustand?
Reasoning LLM = Was meint der Nutzer, welche Rückfrage fehlt und wie sind valide Optionen abzuwägen?
Mutation Engine = Welche bestätigte/zulässige Zustandsänderung wird tatsächlich persistiert?
```

Persönlicher PWA-Runtime-State wird nicht in GitHub gespeichert. `MC-Micro/pal-vault` bleibt eine separate private Kontinuitätsquelle für ausdrücklich dort gespeicherte Projekte und ist keine verpflichtende Abhängigkeit für andere PWA-Nutzer.

Aktuelle Lesereihenfolge für diesen Baustein:

1. [`docs/BREEDER_AI_CURRENT_BLUEPRINT.md`](docs/BREEDER_AI_CURRENT_BLUEPRINT.md)
2. [`docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`](docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md)
3. [`docs/BREEDER_AI_CAPABILITY_INDEX.md`](docs/BREEDER_AI_CAPABILITY_INDEX.md)
4. [`docs/BREEDER_AI_PWA_ARCHITECTURE.md`](docs/BREEDER_AI_PWA_ARCHITECTURE.md)
5. [`docs/BREEDING_PLANNER_ARCHITECTURE.md`](docs/BREEDING_PLANNER_ARCHITECTURE.md)
6. [`docs/BREEDER_AI_SOCIAL_ARCHITECTURE.md`](docs/BREEDER_AI_SOCIAL_ARCHITECTURE.md)
