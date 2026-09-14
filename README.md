# Pal Tool

`MC-Micro/pal-tool` ist die öffentliche technische Wahrheit für allgemeine Palworld-Spieldaten, kanonische Fachdomains und die darauf aufbauenden Werkzeuge und Anwendungen.

Das Repository ist historisch aus der Palworld Passives PWA entstanden, hat sich inzwischen aber zu einer gemeinsamen Pal-Data-/Breeder-/Tool-Plattform weiterentwickelt. Die neue Breeder AI PWA ist der zentrale Anwendungsausbau; die bestehende Passives PWA bleibt als eigenständiges leichtgewichtiges Side-Tool erhalten.

## Aktive und geplante Bausteine

1. im Aufbau befindlicher **Pal Data Core** unter `data/palworld-core/` als gemeinsame buildbezogene Datengrundlage;
2. kanonische **Breeding-Regel- und Datenebene** unter `data/palworld-breeding/`;
3. daraus erzeugte read-only **Breeding API mit Cloudflare Worker und öffentlichem MCP** unter `services/breeding-api/`;
4. **Breeder AI PWA** mit einem isolierten lokalen Phase-0-Spike unter `apps/breeder-ai/` als Vorstufe der privaten Friends-&-Family-Anwendung;
5. bestehende installierbare **Palworld Passives PWA** derzeit noch im Repository-Root, langfristig als eigenständige Consumer-App auf gemeinsamen kanonischen Daten;
6. **GitHub-natives Data-Core-Tooling** unter `tools/pal-data-core/`.

Die bestehende Breeding Runtime verwendet weiterhin ausschließlich vorab erzeugte Repository-Artefakte und ruft bei einem normalen Request weder GitHub noch externe Zuchtrechner auf.

Für Breeder AI existiert nun ausschließlich ein lokaler Phase-0-Proof mit Auth-/Identity-, D1-/Concurrency-, Resolver- und Providergrenzen. Er stellt keine produktive Runtime oder API bereit; es wurden keine Cloud-Datenbank, Access-Policy, MCP-Funktion oder Deploymentfolge angelegt. Details und offene Live-Proofs stehen in [`apps/breeder-ai/README.md`](apps/breeder-ai/README.md).

## Repository-Grenzen

- Allgemeine Palworld-Spielwahrheit, Data Core, Fachregeln, Engines und öffentliche Anwendungslogik: dieses Repository.
- Der bestehende öffentliche Breeder unter `services/breeding-api/` bleibt read-only und stateless bezogen auf privaten Userstate.
- Die neue Breeder-AI-Runtime wird als eigener App-/Package-Bereich isoliert. Vorgesehener Zielbereich ist `apps/breeder-ai/`; die genaue interne Aufteilung wird in Phase 0 festgelegt.
- Persönlicher Multi-User-Runtime-State der Breeder AI: ausschließlich authentifizierte private Runtime-Persistenz; niemals Commit in dieses öffentliche Repository.
- Die historische Passives PWA bleibt ein eigenständiges öffentliches Side-Tool. Ihre spätere kontrollierte physische Migration aus dem Root in einen eigenen App-Bereich erfolgt separat und ist kein Phase-0-Blocker.
- Ausdrücklich im Vault gespeicherte persönliche Projekte und Kontinuität: `MC-Micro/pal-vault`.
- Server-/Hoststeuerung: `MC-Micro/pal-control`.

`pal-tool` darf für Build, Tests oder öffentliche Runtime nicht von den privaten Repositories abhängig sein. Die Friends-&-Family-PWA darf insbesondere nicht voraussetzen, dass jeder Nutzer einen eigenen Vault-Bereich oder eine Git-Datei besitzt.

## Gemeinsamer Datenfluss für Consumer-Apps

Ziel ist eine gemeinsame Spielwahrheit mit getrennten Produktoberflächen:

```text
offizielle Palworld-Daten
→ Technical Core
→ kanonische Domain-Daten / validierte Fachartefakte
→ app-spezifische generierte Consumer-Artefakte
→ Breeder AI / Passives PWA / weitere Tools
```

UI-spezifische Bewertungen, Erklärungen, Prioritäten oder redaktionelle Tags dürfen getrennte Overlay-Daten bleiben und werden nicht allein durch ihre Nutzung in einer App zu kanonischer Spielwahrheit.

## Einstieg für neue Chats und Maintainer

- Repositoryweite Arbeitsregeln: [`AGENTS.md`](AGENTS.md)
- **Breeder-AI-Pre-Build-Verträge:** [`docs/BREEDER_AI_PREBUILD_CONTRACTS.md`](docs/BREEDER_AI_PREBUILD_CONTRACTS.md)
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

Für Breeder-AI-Implementierungsarbeit sind zuerst die Pre-Build Contracts und danach `BREEDER_AI_CURRENT_BLUEPRINT.md` zu lesen. Der Implementierungsfahrplan definiert anschließend Phasen, Gates, Stopppunkte und Testanforderungen. Der Capability-Index verweist auf spezialisierte spätere Planner-Domains.

Chatverläufe sind kein dauerhafter Projektspeicher. Materielle Entscheidungen, Architekturänderungen, Validierungsergebnisse, Deploymentfolgen und offene Restschritte müssen in den passenden getrackten Dateien aktualisiert werden. Persönliche Gesprächsinhalte, Tokens, Zugangsdaten und authentifizierte URLs gehören nicht ins Repository.

## Repository-Struktur

Aktueller physischer Stand:

```text
.
├── index.html, app.js, app.css
├── data-passives.js, data-overrides.js
├── apps/
│   └── breeder-ai/        # lokaler Phase-0-Spike, nicht deployt
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

Zielstruktur nach kontrollierter Migration der Consumer-Apps:

```text
.
├── apps/
│   ├── breeder-ai/
│   └── passives-pwa/
├── data/
│   ├── palworld-core/
│   └── palworld-breeding/
├── services/
│   └── breeding-api/
├── tools/
│   └── pal-data-core/
├── docs/
├── scripts/
├── .github/workflows/
└── AGENTS.md
```

Die physische Verschiebung der bestehenden Passives PWA ist nicht Teil des aktuellen Konzept-PRs. Service-Worker-Scope, Manifest, Hostingpfad und bestehende Installationen müssen in einem separaten Refactor geprüft werden.

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

Sie bleibt als eigenständiges Side-Tool erhalten, ist aber nicht mehr die strukturelle Hauptanwendung des Repositorys. Der aktuelle Root-Stand bleibt zunächst funktionsfähig; eine spätere Migration in einen eigenen App-Bereich erfolgt kontrolliert und rückwärtskompatibel.

Langfristig soll die PWA kanonische Passive-Daten aus derselben Data-Core-/Domain-Pipeline beziehen wie andere Consumer. App-spezifische Rollenprioritäten, Erklärungen und redaktionelle Einordnungen können als getrennte Overlay-Schicht bestehen bleiben.

## Aktueller Produktumfang

- deutsche und englische Namen;
- deutsche und englische Effekte;
- verständliche Erklärungen;
- Rang- und Statusanzeige;
- rollenabhängige Prioritäten;
- Multi-Rollen-Filter;
- Top-Passives-Sortierung;
- installierbare PWA mit Offline-Cache.

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

Die Breeder AI PWA ist der zentrale neue Anwendungsausbau des Repositorys. Sie ergänzt den Breeder um eine private, geräteübergreifende Multi-User-Oberfläche für Friends-&-Family-Nutzung, ohne den öffentlichen Breeder schreibend oder user-state-haltend zu machen.

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

1. [`docs/BREEDER_AI_PREBUILD_CONTRACTS.md`](docs/BREEDER_AI_PREBUILD_CONTRACTS.md)
2. [`docs/BREEDER_AI_CURRENT_BLUEPRINT.md`](docs/BREEDER_AI_CURRENT_BLUEPRINT.md)
3. [`docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`](docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md)
4. [`docs/BREEDER_AI_CAPABILITY_INDEX.md`](docs/BREEDER_AI_CAPABILITY_INDEX.md)
5. [`docs/BREEDER_AI_PWA_ARCHITECTURE.md`](docs/BREEDER_AI_PWA_ARCHITECTURE.md)
6. [`docs/BREEDING_PLANNER_ARCHITECTURE.md`](docs/BREEDING_PLANNER_ARCHITECTURE.md)
7. [`docs/BREEDER_AI_SOCIAL_ARCHITECTURE.md`](docs/BREEDER_AI_SOCIAL_ARCHITECTURE.md)
