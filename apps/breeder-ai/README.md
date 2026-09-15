# Breeder AI – lokaler Phase-0-Spike

**Stand:** 15. September 2026
**Status:** lokaler technischer Proof; keine produktive Runtime, keine Cloud-Ressource und kein Deployment

Dieser Bereich ist die isolierte Phase-0-Probe für die geplante private Breeder-AI-Anwendung. Er verändert weder die öffentliche read-only Breeding API unter `services/breeding-api/` noch die historische Passives PWA im Repository-Root.

Der vollständige chatübergreifende technische Handoff steht in [`docs/BREEDER_AI_PHASE0_COMPLETION_REPORT.md`](../../docs/BREEDER_AI_PHASE0_COMPLETION_REPORT.md).

## Ergebnis und Grenze

Der Spike beweist lokal:

- kryptographische RS256-Prüfung einer Cloudflare-Access-artigen Application-JWT gegen injizierte JWKS einschließlich Application-Token-Typ `app`, `iss`, `aud`, `sub`, `exp` und `nbf`;
- qualifiziertes Identity-Mapping `provider + issuer + subject -> auth_identity_id -> user_id`, ohne E-Mail als Identität zu verwenden;
- autorisierten Identity-Rebind mit stabiler `user_id`, Deaktivierung der alten Identity und getrenntem Rebind-Audit;
- Owner- und `play_space_id`-Isolation;
- atomaren D1-Commit von State, Revision, Mutation Log und Idempotency Receipt;
- Receipt-first Retry, deterministische Payload-Bindung, Parallelzustellung, harte Konflikte und vollständigen Rollback;
- einen Resolver über die 299 kanonischen Species mit DE-/EN-Namen, belegten Aliasen, Varianten/Formen, Ambiguität und nicht-autoritativen Fuzzy-Kandidaten;
- Providergrenzen für Reasoning, Speech und Research mit strikter strukturierter Ausgabe, Timeouts und Test-Doubles.

Ausdrücklich nicht bewiesen sind:

- ein echter E-Mail-OTP-Login, eine reale Cloudflare-Access-Policy und ein Live-JWKS-Abruf;
- tatsächliche Multi-Device-Sitzungen oder ein echter E-Mail-Wechsel;
- die endgültige Static-Assets-/API-Topologie;
- Remote-D1-Verhalten, Migration, Backup und Restore in einer echten Cloud-Ressource;
- reale Reasoning-, Speech- oder Research-Provider, deren aktuelle Modelle, Limits, Kosten und Retention;
- ein autoritativer oder belastbarer nichtpersistenter Passive-Resolver; für diese Domain wurde bewusst kein Key erfunden und der Provider-Mention-Typ ist kein Resolver-Proof;
- eine produktive API, UI oder Phase-1-Inventory-Runtime.

Der Worker-Einstieg antwortet ausschließlich mit HTTP 503 und `PHASE0_LOCAL_SPIKE_ONLY`. Die Wrangler-Konfiguration enthält nur eine offensichtlich ungültige Null-ID und der Build-Befehl nutzt immer `--dry-run`.

## Struktur

```text
apps/breeder-ai/
├── migrations/0001_phase0_spike.sql
├── scripts/scan-secrets.ts
├── src/
│   ├── auth/
│   ├── domain/
│   ├── persistence/
│   ├── providers/
│   ├── resolver/
│   └── shared/
├── test/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
└── wrangler.jsonc
```

Die Runtime-Schichten sind nach Verantwortlichkeit getrennt. Auth erzeugt den serverseitigen Kontext, Persistenz akzeptiert nur diesen Kontext und einen expliziten Play-Space, der Resolver liefert kanonische Kandidaten, und Provider dürfen lediglich Mentions beziehungsweise Action-Entwürfe liefern. Kein Provider erhält SQL oder frei wählbare User-IDs.

## Phase-0-Datenmodell

Die Migration enthält ausschließlich Spike-Tabellen:

- `users`;
- `auth_identities`;
- `identity_rebinds`;
- `play_spaces`;
- `inventory_states`;
- `idempotency_receipts`;
- `mutations`.

`state_revision` liegt entsprechend dem Pre-Build-Vertrag auf `user_id + play_space_id`. `inventory_states.state_json` enthält nur minimale Bulk-Zähler und Notizen, damit die Commit-Semantik real getestet werden kann. Jeder gespeicherte Bulk-Eintrag trägt neben dem Zähler die qualifizierte Species-Referenz mit Dataset-Fingerprint. Dies ist ausdrücklich kein endgültiges Phase-1-Schema.

### Identity

Eine autoritative externe Identität ist das qualifizierte Tupel aus `provider`, `issuer` und `subject`. E-Mail wird weder persistiert noch zum Finden oder Zusammenführen eines Users verwendet. Eine unbekannte Identität provisioniert keinen Zustand. `VerifiedExternalIdentity` entsteht im regulären Anwendungspfad nur durch die erfolgreiche `AuthVerifier`-Boundary. Der TypeScript-Brand verhindert versehentliche Typvermischung, ist aber kein Runtime-Sicherheitsmechanismus. Self-Service-Rebind beginnt zwingend aus einem aktiven, bereits aufgelösten `AuthContext`; Admin-Recovery bleibt als eigener Port getrennt.

Die lokale JWT-Probe prüft die kryptographische und Claim-seitige Servergrenze. Der Live-Adapter zum Abruf und Caching der Access-JWKS bleibt absichtlich offen. Cloudflare beschreibt die Validierung des `Cf-Access-Jwt-Assertion` und die Application-Token-Claims in der offiziellen Dokumentation:

- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/>

### Commit und Retry

Der normalisierte Mutation-Payload umfasst `mutationId`, `expectedStateRevision` und die kanonisch serialisierte Action-Gruppe. Das vollständige Envelope und jede Action werden vor einem Datenbankzugriff durch ein striktes Runtime-Schema geprüft. `traceId` korreliert den ursprünglichen Workflow, der Idempotency-Key adressiert das Receipt und bleibt davon getrennt.

Ein neuer Commit verwendet ein einzelnes D1-`batch()`:

1. Receipt nur bei passender Revision beanspruchen;
2. State und Revision nur für genau dieses Receipt aktualisieren;
3. Mutation Log nur für genau dieses Receipt schreiben.

Scheitert eine spätere Anweisung, wird die gesamte Gruppe zurückgerollt. Nach einem Race wird das Receipt erneut gelesen: identischer Payload liefert das gespeicherte Ergebnis, anderer Payload einen harten Konflikt. Cloudflare dokumentiert `batch()` als transaktional und die lokale D1-Entwicklung als produktionsnahe Miniflare-Simulation:

- <https://developers.cloudflare.com/d1/worker-api/d1-database/>
- <https://developers.cloudflare.com/d1/best-practices/local-development/>

### Species-Crosswalk

Die dauerhafte Phase-0-Referenz ist:

```text
namespace = palworld.species.internal_name
value     = canonical internal_name
dataset   = schema version + game version + build id + technical snapshot hash
```

Der Resolver importiert `data/palworld-breeding/pal_values.json` und `manifest.json` direkt. Der technische Snapshot wird ausschließlich aus der genau einmal vorhandenen Manifest-Quelle mit Rolle `canonical_primary_source` gelesen; fehlende, doppelte oder fehlerhafte Rollen-/Hash-Metadaten brechen fail-closed ab. Numerische REST-IDs, Paldecknummern, `internal_index`, `sourceOrdinal`, Array- oder Generatorpositionen werden nicht persistiert. Ein Fuzzy-Treffer ist immer nur ein Kandidat. Bei einem anderen Dataset oder unbekannten Key wird eine explizite Migration verlangt; es gibt keine automatische Positions- oder Fuzzy-Migration.

Für Passiven wurde kein Resolver ergänzt. `data-passives.js` ist der redaktionelle Produktdaten-Overlay der historischen PWA; sein Feld `nr` ist keine dauerhafte Domain-Identität. Pal Data Core führt `DT_PassiveSkill_Main` derzeit nur als `inventory_only` und hat noch kein freigegebenes kanonisches Passive-Domain-Artefakt mit belastbarem Lokalisierungs-/Crosswalk-Vertrag. Damit ist auch ein als belastbar geltender nichtpersistenter Passive-Mention/Candidate-Proof noch offen.

## Entscheidungen

### Klasse A – Implementierungsdetails

- eigenständiges, privates pnpm-Package unter `apps/breeder-ai/`;
- TypeScript strict, ESLint, Vitest und offizielles Cloudflare-Vitest-Plugin;
- lokale Workerd-/Miniflare-D1-Tests mit Migration pro isoliertem Test;
- kanonische JSON-Serialisierung plus SHA-256 für Receipt-Payloads;
- deaktivierter Research-Adapter und skriptbare Reasoning-/Speech-Doubles;
- 503-only Worker-Shell und lokaler Wrangler-Dry-Run.

### Klasse B – begrenzte Präzisierungen

- `auth_identity_id` ist eine eigene interne Zeilenidentität; die externe Eindeutigkeit bleibt `provider + issuer + subject`;
- der Phase-0-State bleibt bewusst als minimales JSON-Aggregat pro User/Play-Space, damit die verbindliche Commit-Grenze ohne vorschnelles Produktionsschema geprüft werden kann;
- der Species-Key wird als namespaceter Adapter-Key mit Dataset-Fingerprint geführt;
- der normalisierte Idempotency-Payload bindet Mutation-ID, erwartete Revision und Action-Gruppe; Trace und Key behalten ihre getrennten Rollen;
- Self-Service-Rebind deaktiviert die alte Identity atomar. Eine spätere Grace-/Recovery-Policy ist eine Phase-1-/Security-Entscheidung.

### Klasse C

Es trat kein Klasse-C-Konflikt auf. Keine bestehende Sicherheits-, Identity-, Tenant-, Datenintegritäts- oder Repository-Grenze musste geändert werden.

## Lokale Validierung

Voraussetzungen: Node.js 22+ und pnpm 11.19.0.

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build:worker
pnpm run scan:secrets
```

Die Tests laufen vollständig lokal in Workerd/Miniflare über das offizielle Vitest-Plugin. Die Verwendung dieses Runtimes entspricht der aktuellen Cloudflare-Testempfehlung:

- <https://developers.cloudflare.com/workers/testing/vitest-integration/>

## Phase-1-Gate

Vor Phase 1 ist ein Review dieses Spikes erforderlich. Danach müssen mindestens entschieden beziehungsweise live bewiesen werden:

1. belastbarer Passive-Domain-/Candidate-Input und Resolver-Crosswalk;
2. echte Access-Anwendung, OTP-Policy, Allowlist/Provisioning und JWT-Weitergabe;
3. sicherer JWKS-Abruf mit Cache-/Rotation-/Failure-Verhalten;
4. reale Multi-Device- und Rebind-Abläufe;
5. Static-Assets-/API-Grenze;
6. Remote-D1-Migration, Backup, Restore und Rollback;
7. Providerwahl nach erneuter aktueller Prüfung;
8. endgültige Aggregate und feinere Revisionen, falls sie die bewiesenen Invarianten erhalten.

Bis zu einer neuen ausdrücklichen Freigabe endet die Arbeit an diesem Review-Gate.
