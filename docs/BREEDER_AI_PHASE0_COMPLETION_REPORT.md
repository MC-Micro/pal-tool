# Breeder AI – Phase-0-Abschlussbericht und technischer Handoff

**Berichtsstand:** 14. September 2026

**Ergebnis:** Der lokale Phase-0-Auftrag wurde auf `codex/breeder-ai-phase0-spikes` bis zum vorgesehenen Review-Stop ausgeführt. Die lokalen Auth-/Identity-, D1-/Concurrency-, Species-Resolver- und Provider-Proofs sind grün. Das externe Phase-0-Gate ist ausdrücklich noch offen.

**Nicht erfolgt:** Push, Pull Request, Merge, Deployment, produktive Cloud-Ressource, Secret-Änderung, Remote-D1-Erstellung, Access-Policy-Änderung oder Änderung der öffentlichen Breeding API beziehungsweise ihres MCP.

---

## 1. Zweck und Dokumentrang

Dieser Bericht ist der dauerhafte technische Abschluss-Handoff für andere Projektchats, Codex-/Work-Aufgaben und menschliche Maintainer. Er beschreibt:

- den verifizierten Ausgangszustand;
- den tatsächlich implementierten Phase-0-Scope;
- die bewiesenen und noch unbewiesenen Annahmen;
- die Architekturentscheidungen der Klassen A, B und C;
- die exakte lokale Validierung;
- Risiken, technische Schuld und den nächsten zulässigen Schritt.

Der Bericht ersetzt keine höherrangigen Regeln oder Verträge. Bei Widersprüchen gilt weiterhin die im Repository dokumentierte Vorrangfolge:

1. `AGENTS.md`;
2. `docs/BREEDER_AI_PREBUILD_CONTRACTS.md`;
3. `docs/BREEDER_AI_CURRENT_BLUEPRINT.md`;
4. `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`;
5. dieser Abschlussbericht;
6. spezialisierte ältere Konzeptdokumente;
7. Chatannahmen.

Hashes und externe Zustände in diesem Bericht sind Provenienz des Abschlusszeitpunkts. Ein neuer technischer Auftrag muss Branch, Working Tree, `main`, Remote, Pull Requests, Abhängigkeiten, Patchstand und Live-Erreichbarkeit erneut dynamisch prüfen.

---

## 2. Verifizierter Ausgangszustand

Vor Änderungen wurde der Repository-Zustand lokal und gegen den Remote geprüft.

| Merkmal | Verifizierter Stand |
| --- | --- |
| Repository | `MC-Micro/pal-tool` |
| Checkout | `C:\Users\Micro\Documents\GitHub\pal-tool-phase0` |
| Arbeitsbranch | `codex/breeder-ai-phase0-spikes` |
| Ausgangs-`HEAD` | `b272489dbd5c618d0e9f90e824afb353abdea3e6` |
| lokales `main` | `b272489dbd5c618d0e9f90e824afb353abdea3e6` |
| lokales `origin/main` | `b272489dbd5c618d0e9f90e824afb353abdea3e6` |
| live abgefragtes Remote-`main` | `b272489dbd5c618d0e9f90e824afb353abdea3e6` |
| Remote | `https://github.com/MC-Micro/pal-tool.git` |
| offene Pull Requests beim Startaudit | 0 |
| getrackter Working Tree beim Start | sauber |
| lokale Operator-Handoff | `CODEX_PHASE0_START.md`, bewusst ignoriert und nicht committet |

Der Remote-`main`-Hash wurde am Ende nochmals rein lesend geprüft und war weiterhin identisch. Fremde uncommittete Produktänderungen waren nicht vorhanden.

### Gelesene Grundlagen

Vor der Implementierung wurden vollständig und in der vorgeschriebenen Reihenfolge gelesen:

1. `AGENTS.md`;
2. `README.md`;
3. `docs/BREEDER_AI_PREBUILD_CONTRACTS.md`;
4. `docs/BREEDER_AI_CURRENT_BLUEPRINT.md`;
5. `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`.

Für den Species-/Resolver-Teil zusätzlich:

1. `data/palworld-breeding/breeding_rules.json`;
2. `data/palworld-breeding/special_combinations.json`;
3. `data/palworld-breeding/pal_values.json`;
4. `data/palworld-breeding/manifest.json`.

Ergänzend wurden die einschlägigen Data-/Breeding-READMEs, `services/breeding-api/HANDOFF_CHATGPT.md` und `docs/BREEDER_AI_PWA_ARCHITECTURE.md` gelesen. Der bestehende Breeding-Service und die historische Passives PWA wurden nicht verändert.

---

## 3. Ausgeführter Scope

Unter `apps/breeder-ai/` wurde ein eigenständiges lokales Phase-0-Package angelegt:

```text
apps/breeder-ai/
├── migrations/
│   └── 0001_phase0_spike.sql
├── scripts/
│   └── scan-secrets.ts
├── src/
│   ├── auth/
│   │   ├── cloudflare-access-verifier.ts
│   │   ├── contracts.ts
│   │   └── identity-service.ts
│   ├── persistence/
│   │   └── state-store.ts
│   ├── providers/
│   │   ├── contracts.ts
│   │   └── test-doubles.ts
│   ├── resolver/
│   │   └── species-resolver.ts
│   ├── shared/
│   │   └── canonical-json.ts
│   ├── env.d.ts
│   └── index.ts
├── test/
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
└── wrangler.jsonc
```

Die Struktur isoliert die private geplante Runtime vollständig von:

- `services/breeding-api/`;
- dem öffentlichen read-only MCP;
- der historischen Passives PWA;
- `MC-Micro/pal-vault`;
- `MC-Micro/pal-control`.

Es wurde keine Phase-1-Produktfunktion, kein vollständiges Inventory, kein Planner, kein Social-/Showcase-Bereich, keine UI und keine produktive Speech-/LLM-Anbindung begonnen.

---

## 4. Auth-/Identity-Spike

### 4.1 Verifizierte Principal-Grenze

Die externe Identität wird als qualifiziertes Tupel behandelt:

```text
provider + issuer + subject
    -> auth_identity_id
    -> stable user_id
```

`email` ist optionaler Verifier-Output, aber weder dauerhafte Identität noch Lookup-, Merge- oder Autorisierungsmerkmal.

Der `CloudflareAccessJwtVerifier` prüft lokal:

- JWT-Struktur;
- ausschließlich `RS256`;
- `kid`;
- kryptographische Signatur gegen einen über `JwksResolver` gelieferten JWK;
- exakten `issuer`;
- erwartete `audience`;
- nichtleeren `subject`;
- `exp`;
- optionales `nbf`;
- konfigurierten Clock Skew.

Erst nach erfolgreicher Signatur- und Claimprüfung entsteht eine typisierte `VerifiedExternalIdentity`. Die Tests erzeugen ein echtes RSA-Schlüsselpaar im Workerd-Web-Crypto-Runtime, signieren eine JWT und prüfen positive sowie manipulierte, falsche und abgelaufene Assertions.

Offizieller Referenzrahmen:

- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/>

### 4.2 Identity-Mapping

`resolveAuthContext` liest ausschließlich aktive `auth_identities` eines aktiven Users. Eine unbekannte externe Identität:

- erhält keinen bestehenden User;
- erzeugt keinen neuen User;
- provisioniert keinen Bestand;
- kann nicht über eine gleiche E-Mail mit einem anderen User zusammengeführt werden.

Identische Subjects verschiedener Issuer oder Provider bleiben getrennt.

### 4.3 Self-Service-Rebind

`rebindIdentity` setzt voraus:

- einen bereits serverseitig aufgelösten aktiven `AuthContext`;
- eine verifizierte Replacement-Identity;
- eine eigene neue `auth_identity_id`;
- `trace_id` und Rebind-Audit-ID.

In einem D1-Batch werden:

1. die neue Identity an dieselbe `user_id` gebunden;
2. die alte Identity deaktiviert;
3. der Rebind in `identity_rebinds` protokolliert.

Eine bereits einem anderen User zugeordnete Replacement-Identity erzeugt einen harten Konflikt. Eine neue externe Identity allein kann keine bestehende `user_id` übernehmen.

Admin-Recovery wurde nicht als Hintertür in den Self-Service eingebaut. Es existiert nur ein separater `AdminRecoveryPort`-Vertrag; eine produktive Recovery-Implementierung ist bewusst offen.

### 4.4 Noch offener Auth-Live-Proof

Nicht lokal ersetzbar und deshalb nicht als bewiesen markiert:

- echte Cloudflare-Access-Anwendung;
- E-Mail-OTP-Policy;
- Allowlist versus App-Provisioning;
- Live-Weitergabe von `Cf-Access-Jwt-Assertion`;
- Abruf, Cache, Rotation und Failure-Verhalten echter JWKS;
- zwei reale Geräte mit gleicher `user_id`;
- realer E-Mail-Wechsel und Verifikation;
- Logout-, Session-Revoke- und Recovery-Verhalten;
- endgültige Static-Assets-/API-Grenze.

Vor hierfür notwendigen Cloud-Änderungen wurde regelkonform gestoppt.

---

## 5. D1-/Persistenz-/Concurrency-Spike

### 5.1 Spike-Schema

Die lokale Migration enthält:

| Tabelle | Phase-0-Zweck |
| --- | --- |
| `users` | stabile interne User-ID und Status |
| `auth_identities` | qualifizierte externe Identity-Bindung |
| `identity_rebinds` | getrenntes Rebind-Audit |
| `play_spaces` | Owner-/Spielkontextgrenze |
| `inventory_states` | minimales JSON-Testaggregat mit Revision |
| `idempotency_receipts` | reproduzierbares Commit-Ergebnis pro Scope und Key |
| `mutations` | autoritatives Mutation Log |

Das Schema verwendet Foreign Keys, CHECKs und Unique Constraints. Es ist ein Spike-Schema und ausdrücklich kein finaler Phase-1-Datenentwurf.

### 5.2 Verbindliche Commit-Grenze

`state_revision` liegt auf:

```text
user_id + play_space_id
```

Jede Mutation besitzt:

- `mutation_id`;
- `trace_id`;
- davon getrennten `idempotency_key`;
- `expected_state_revision`;
- eine nichtleere, vorab validierte Action-Gruppe.

Der normalisierte Idempotency-Payload bindet:

- `mutationId`;
- `expectedStateRevision`;
- kanonisch serialisierte Actions.

Die Payload wird deterministisch serialisiert und mit SHA-256 gebunden. User und Play-Space bilden den Receipt-Scope. `trace_id` bleibt Workflow-/Diagnosekorrelation und wird nicht mit dem Idempotency-Key gleichgesetzt.

### 5.3 Atomarer Commit

Ein neuer Commit verwendet ein einziges D1-`batch()`:

1. Receipt nur bei passender aktueller Revision beanspruchen;
2. State und Revision nur aktualisieren, wenn genau dieses Receipt mit Mutation-ID und Payload-Hash existiert;
3. Mutation Log nur für genau dieses Receipt schreiben.

Die konkrete D1-Technik nutzt bedingte `INSERT`-/`UPDATE`-Statements und `RETURNING`. Eine absichtlich erzeugte spätere Constraint-Verletzung beweist im Test, dass Receipt, State und Revision zusammen zurückgerollt werden.

Cloudflare dokumentiert D1-`batch()` als transaktional; die lokale Entwicklungsumgebung läuft über Miniflare:

- <https://developers.cloudflare.com/d1/worker-api/d1-database/>
- <https://developers.cloudflare.com/d1/best-practices/local-development/>

### 5.4 Retry- und Konfliktverhalten

Die implementierte Reihenfolge ist:

1. Envelope-Basisvalidierung;
2. normalisierten Payload und Hash bilden;
3. vorhandenes Receipt im User-/Play-Space-Scope zuerst prüfen;
4. bei identischem Payload das gespeicherte Commit-Ergebnis zurückgeben;
5. bei anderem Payload einen `IdempotencyConflictError` auslösen;
6. nur ohne Receipt die erwartete Revision prüfen;
7. Actions vollständig vor dem Schreiben anwenden und validieren;
8. atomaren Batch versuchen;
9. nach einem möglichen Race das Receipt erneut auflösen.

Damit gilt:

- Same-Key/Same-Payload: genau ein fachlicher Commit;
- Same-Key/Different-Payload: harter Konflikt;
- stale Revision ohne passendes Receipt: expliziter Revisionskonflikt;
- kein Last-Write-Wins;
- Action Group: vollständig oder gar nicht;
- Lost Response: Retry liefert das gespeicherte Ergebnis;
- parallele identische Requests: ein Originallauf plus ein Duplikatergebnis.

### 5.5 Tenant-Grenze

Reads und Writes verwenden immer:

```text
AuthContext.userId + explicit playSpaceId
```

Die Abfragen prüfen den aktiven, dem User gehörenden Play-Space. Cross-User- und Cross-Play-Space-Zugriffe werden negativ getestet. Eine clientseitig frei übermittelte `user_id` ist kein Parameter der Mutation.

---

## 6. Species-Resolver und dauerhafte Crosswalk-Grenze

### 6.1 Autoritative Eingaben

Der Resolver verwendet direkt:

- `data/palworld-breeding/pal_values.json`;
- `data/palworld-breeding/manifest.json`.

Er verwendet keine generierte REST-Array-ID als Domain-Identität und verändert keine kanonischen Daten.

### 6.2 Dauerhafte Phase-0-Referenz

```text
namespace = palworld.species.internal_name
value     = canonical internal_name
dataset   = schema version
          + game version
          + dedicated server build id
          + technical snapshot SHA-256
```

Gebundener Dataset-Stand:

| Feld | Wert |
| --- | --- |
| Schema-Version | `5` |
| geprüfte Spielversion | `1.0.3` |
| Dedicated-Server-Build | `24575149` |
| Technical-Snapshot-SHA-256 | `78b598e7a4745f11061411ed0c976fac4e06d21ee9d9bb3002a0e90324b827cc` |

Dieser Fingerprint belegt, gegen welches Repository-Dataset der Spike lief. Er ist keine Behauptung, dass kein neueres Palworld-Release existiert. Vor jeder künftigen Aktualitätskennzeichnung bleibt der vorgeschriebene Patch-Recheck erforderlich.

### 6.3 Resolververhalten

Der Resolver indexiert 299 kanonische Species und berücksichtigt:

- `internal_name`;
- Game-Table-Row;
- deutsche Namen;
- englische Namen;
- diakritische beziehungsweise deutsche Umschrift;
- belegte Varianten/Formen;
- echte Namensmehrdeutigkeit.

Ergebnisarten:

- `resolved` nur bei genauem eindeutigem Treffer;
- `ambiguous` mit allen exakten Kandidaten;
- `candidates` für Fuzzy-Kandidaten;
- `not_found` ohne belastbaren Kandidaten.

Ein Fuzzy-Kandidat wird niemals automatisch zu einer autoritativen Auflösung oder Migration hochgestuft.

Nicht als dauerhafte Species-ID verwendet:

- numerische REST-`id`;
- Paldecknummer;
- `internal_index`;
- `sourceOrdinal`;
- Arrayposition;
- Generatorposition.

Ein fremder Dataset-Fingerprint verlangt eine explizite Migration. Ein unbekannter Key wird nicht per Stringähnlichkeit migriert.

### 6.4 Bewusste Passive-Grenze

Für Passiven wurde kein vermeintlich stabiler Key erfunden. Der Providervertrag darf Passive-Mentions enthalten, aber es gibt noch keine autoritative Passive-Auflösung oder -Persistenz.

---

## 7. Provider-Spike

Es wurden getrennte Interfaces angelegt für:

- `ReasoningProvider`;
- `SpeechProvider`;
- `ResearchProvider`.

Die strukturierte Reasoning-Ausgabe wird mit einem strikten Zod-Schema geprüft. Provider dürfen:

- Intent klassifizieren;
- Species-/Passive-Mentions liefern;
- begrenzte Action-Entwürfe vorschlagen;
- eine Rückfrage formulieren.

Provider dürfen nicht:

- kanonische IDs erfinden;
- SQL ausführen;
- direkt persistieren;
- eine Ziel-`user_id` bestimmen;
- kanonische Spielwahrheit verändern.

Zusätzliche Grenzen:

- Timeout über `AbortSignal`;
- normalisierte Fehlercodes `TIMEOUT`, `UNAVAILABLE`, `INVALID_OUTPUT` und `DISABLED`;
- Research standardmäßig deaktiviert;
- Reasoning und Speech über skriptbare Test-Doubles;
- Speech liefert nur Text zurück und ist nicht mit Mutation gekoppelt.

Es wurde bewusst kein realer Anbieter ausgewählt. Modelle, strukturierte Tools, Audioformate, Custom Vocabulary, Limits, Kosten und Retention müssen vor einer Anbieterentscheidung erneut anhand aktueller Primärquellen geprüft werden.

---

## 8. Worker-, Deployment- und Secret-Schutz

`src/index.ts` stellt keine Produkt-API bereit. Jeder Aufruf erhält:

- HTTP `503`;
- Code `PHASE0_LOCAL_SPIKE_ONLY`;
- `deployed: false`.

`wrangler.jsonc` enthält:

- einen expliziten Phase-0-Namen;
- nur eine Null-D1-ID `00000000-0000-0000-0000-000000000000`;
- deaktivierte Wrangler-Metriken;
- keine Route;
- keine Secrets.

Der einzige Build-Befehl lautet:

```text
wrangler deploy --dry-run --outdir dist
```

Der app-spezifische Secret-Scan verwirft Secret-Dateien und prüft bekannte hochriskante Tokenmuster. `node_modules`, `dist`, `coverage` und `.wrangler` sind ignoriert.

Es gibt keinen Deploy-Script und keinen Deploy-Workflow.

---

## 9. Tooling und CI

Direkte Abhängigkeiten sind exakt gepinnt. Wesentliche Versionen:

| Werkzeug | Version |
| --- | --- |
| Node.js | `>=22` |
| pnpm | `11.19.0` |
| TypeScript | `5.9.3` |
| Vitest | `4.1.10` |
| Cloudflare Vitest Plugin | `1.1.9` |
| Wrangler | `4.131.2` |
| Workers Types | `5.20260914.1` |
| Zod | `4.4.3` |

`pnpm-workspace.yaml` erlaubt ausschließlich die benötigten Build-Skripte von `esbuild` und `workerd`. Das Lockfile wurde gegen die aktive pnpm-Supply-Chain-Policy geprüft.

Der Workflow `.github/workflows/breeder-ai-ci.yml`:

- hat nur `contents: read`;
- enthält keine Secrets;
- besitzt keinen Deploy-Job;
- validiert zunächst die bestehende Repository-PWA/-Datenstruktur;
- installiert mit `--frozen-lockfile`;
- führt Lint, Typecheck, lokale Workerd/D1-Tests, Dry-Run-Build und Secret-Scan aus;
- verwendet immutable GitHub-Action-SHAs.

Der Workflow wurde nur lokal angelegt und nicht durch Push oder PR ausgelöst.

---

## 10. Testmatrix

Finaler lokaler Lauf:

```text
Test Files  6 passed (6)
Tests       33 passed (33)
```

### 10.1 Access-JWT – 2 Tests

- echte lokale RSA-Signatur und qualifizierte Claims werden akzeptiert;
- manipulierte Signatur, falsche Audience und abgelaufenes Token werden abgelehnt.

### 10.2 Auth-/Identity – 7 Tests

- gleiche qualifizierte Identity ergibt auf mehreren simulierten Geräten dieselbe `user_id`;
- gleicher Subject wird nach Provider/Issuer getrennt;
- unbekannte Identity provisioniert keinen User;
- autorisierter Rebind behält die `user_id`;
- eine inaktive Ausgangsidentity darf keinen Rebind ausführen;
- gleiche E-Mail führt nicht zum Account-Merge;
- fremd gebundene Replacement-Identity wird abgelehnt.

### 10.3 Persistenz/Concurrency – 9 Tests

- Lost-Response Retry;
- normaler Duplicate Retry vor erneuter Revisionsprüfung;
- paralleles Same-Key/Same-Payload mit genau einem Commit;
- Same-Key/Different-Payload als harter Konflikt;
- Revision Conflict ohne Last-Write-Wins oder Teilartefakte;
- ungültige Action Group rollt vollständig zurück;
- später Batch-Fehler rollt Receipt, State und Revision zurück;
- User-/Play-Space-Isolation für Reads und Writes;
- `trace_id` darf nicht als `idempotency_key` wiederverwendet werden.

### 10.4 Species-Resolver – 8 Tests

- alle 299 Species ohne Transport-IDs;
- DE-/EN-Crosswalk;
- Diakritik/Umschrift;
- echte Ambiguität;
- Fuzzy nur als Kandidat;
- `not_found`;
- Manifest-Version/-Hash-Bindung;
- explizite Migration statt Fuzzy-/Positionsmigration.

### 10.5 Provider – 6 Tests

- gültiger Action-Entwurf enthält nur Mentions;
- erfundene Canonical IDs werden abgelehnt;
- Providerfehler werden normalisiert;
- Timeout abortiert deterministisch;
- Research bleibt deaktiviert;
- Speech-Double bleibt von Mutation getrennt.

### 10.6 Worker-Shell – 1 Test

- keine Produkt-API; ausschließlich HTTP 503 und Phase-0-Code.

---

## 11. Exakte Validierungsevidenz

Im Package `apps/breeder-ai/`:

| Befehl | Ergebnis |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | erfolgreich, Lockfile aktuell |
| `pnpm run lint` | erfolgreich, 0 Fehler |
| `pnpm run typecheck` | erfolgreich, 0 Fehler |
| `pnpm run test` | 6 Dateien, 33 Tests bestanden |
| `pnpm run build:worker` | Dry Run erfolgreich; 0,26 KiB, gzip 0,21 KiB |
| `pnpm run scan:secrets` | `Breeder AI secret scan PASS` |
| `pnpm run ci` | vollständige Kette erfolgreich |

Im Repository-Root:

| Befehl | Ergebnis |
| --- | --- |
| `node scripts/validate-data.mjs` | 102 Passives, Datenstruktur, PWA-Dateien und Cache-Verweise konsistent |
| `git diff --check main...HEAD` | keine Befunde |
| `git status --short --branch` | getrackter Working Tree sauber |

Die vollständige Breeding-API-Releasekette wurde nicht erneut ausgeführt, weil weder `services/breeding-api/` noch kanonische Breeding-Dateien oder deren generierte Artefakte verändert wurden. Die vorhandene Root-Daten-/PWA-Validierung wurde ausgeführt.

Die Workerd-/Miniflare-Testwahl folgt dem offiziellen Cloudflare-Testweg:

- <https://developers.cloudflare.com/workers/testing/vitest-integration/>
- <https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/>

---

## 12. Beweisstatus

| Bereich | Lokal real bewiesen | Lokal modelliert/mock-basiert | Noch extern zu beweisen |
| --- | --- | --- | --- |
| JWT | RS256, JWK, Signatur und Claims in Workerd | JWK-Resolver injiziert | Live-JWKS, Rotation, echte Assertion |
| Identity | D1-Mapping, Stable User, Rebind, keine E-Mail-Merges | Nutzer/Identitäten als Fixtures | OTP, zwei Geräte, echter E-Mail-Wechsel |
| Tenant | User-/Play-Space-Negativtests | AuthContext aus Testfixtures | komplette Live-Request-Kette |
| D1 | reale lokale D1-Migration, Batch, Race, Rollback | lokales Miniflare-Storage | Remote-D1, Backup, Restore |
| Resolver | reale kanonische Repository-Daten | Fuzzy-Threshold als Spike-Detail | künftige Patch-/Dataset-Migration |
| Provider | Schemas, Timeouts, Fehlergrenzen | Reasoning-/Speech-Doubles | Anbieter, Modelle, Limits, Kosten, Retention |
| Worker | 503-only Bundle und Dry Run | keine Produkt-API | Hosting-/Routingtopologie |

---

## 13. Architekturentscheidungen

### 13.1 Klasse A – Implementierungsdetails

- eigenständiges Package unter `apps/breeder-ai/`;
- TypeScript strict;
- ESLint/Vitest/Workerd/Miniflare;
- eine lokale D1-Migration;
- kanonisches JSON plus SHA-256;
- skriptbare Provider-Doubles;
- 503-only Worker-Shell;
- read-only CI ohne Deployment;
- app-spezifischer Secret-Scan.

### 13.2 Klasse B – begrenzte Präzisierungen

- `auth_identity_id` ist eine separate interne Datensatzidentität; externe Eindeutigkeit bleibt `provider + issuer + subject`;
- der Phase-0-State ist ein minimales JSON-Aggregat pro User/Play-Space;
- Species werden über einen namespaceten `internal_name`-Adapter-Key plus Dataset-Fingerprint referenziert;
- der Idempotency-Payload bindet Mutation-ID, erwartete Revision und Actions;
- Trace und Idempotency-Key behalten getrennte Rollen;
- Self-Service-Rebind deaktiviert die alte Identity atomar;
- eine spätere Grace-/Recovery-Policy bleibt bewusst offen.

Diese Präzisierungen erhalten die Schutzwirkung der Pre-Build-Verträge.

### 13.3 Klasse C – materielle Architekturkonflikte

Es trat kein Klasse-C-Konflikt auf. Keine bestehende Sicherheits-, Identity-, Tenant-, Datenintegritäts-, Determinismus- oder Repository-Grenze musste ersetzt oder aufgeweicht werden.

---

## 14. Risiken

1. **Live-Auth-Semantik:** Stabilität und Lebenszyklus des tatsächlichen Access-`subject` müssen mit der echten Policy geprüft werden.
2. **JWKS-Betrieb:** Cache, Rotation, unbekannte `kid`, Netzwerkfehler und Fail-closed-Verhalten sind noch nicht implementiert.
3. **Custom JWT-Code:** Die kleine Phase-0-Verifikation ist bewusst begrenzt und benötigt vor Produktion Security-Review beziehungsweise eine geprüfte Bibliotheks-/Adapterentscheidung.
4. **Rebind-/Recovery-Policy:** Grace Period, Recovery, Revocation und Missbrauchsschutz sind offen.
5. **Spike-Schema:** Das JSON-Aggregat ist keine vorweggenommene Entscheidung für das endgültige Inventory-Schema.
6. **Concurrency-Granularität:** Eine Revision pro User/Play-Space ist korrekt für Phase 0, kann bei größerem Inventory aber zu unnötiger Konkurrenz führen.
7. **Remote-D1:** Lokale Parität ersetzt keinen echten Migrations-, Backup-, Restore- oder Betriebsproof.
8. **Miniflare-Abhängigkeit:** Das aktuelle offizielle Vitest-Plugin bringt transitiv einen Alpha-Stand von Miniflare mit; Lockfile und CI müssen Updates kontrolliert prüfen.
9. **Provider:** Ohne reale Anbieterprüfung gibt es keine belastbare Aussage zu Qualität, Limits, Kosten oder Datenschutz.
10. **Canonical Freshness:** Der Resolver ist exakt an das Manifest gebunden; ein neuer Palworld-Patch verlangt den vorgeschriebenen Recheck.

---

## 15. Technische Schuld und bewusst offene Arbeit

- Live-JWKS-Resolver mit Cache-/Rotationstests;
- echte serverseitige Auth-Middleware;
- Provisioning-/Allowlist-Entscheidung;
- produktionsreifer Rebind- und Admin-Recovery-Flow;
- Remote-D1-Migrations-, Backup-, Restore- und Rollbackweg;
- endgültige Inventory-Aggregate;
- feinere Revisionsgrenzen nur bei belegtem Bedarf;
- Passive-Domain mit belastbaren stabilen IDs;
- reale Provideradapter;
- Coverage-Schwellen;
- vollständige API-/UI-/PWA-Struktur;
- Health-/Version-Endpunkt erst im zulässigen Phase-1-Skeleton;
- Performance-/Lasttests für größere States und Parallelität.

Diese Punkte sind kein stillschweigender Auftrag zur Weiterimplementierung.

---

## 16. Kompatibilität, Migration, Rollback und Deployment

### Kompatibilität

- Öffentliche Breeding API und MCP unverändert;
- Passives PWA unverändert;
- kanonische Breeding-Daten unverändert;
- keine Abhängigkeit von `pal-vault` oder `pal-control`;
- keine produktive Route.

### Migration

`0001_phase0_spike.sql` ist nur eine lokale Spike-Migration. Sie wurde auf keine Remote-Datenbank angewendet. Es gibt daher keine Produktionsdatenmigration und keine bestehenden Userdaten.

### Rollback

Da alles ausschließlich auf dem lokalen Feature-Branch liegt, ist der technische Rollback das Verwerfen beziehungsweise Nichtübernehmen der lokalen Commit-Serie. Es ist keine Cloud-Ressource zurückzubauen.

### Deployment

Deploymentstatus: **keines**.

Vor einem späteren Deployment bleiben die Gates aus `AGENTS.md` und `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md` bindend. Insbesondere sind erneute ausdrückliche Freigabe, Live-Auth-Proof, D1-Review, Backup-/Rollbackweg und relevante Releasechecks erforderlich.

---

## 17. Lokale Commit-Serie und vollständiger Diff

Ausgangscommit:

```text
b272489dbd5c618d0e9f90e824afb353abdea3e6
```

Implementierungsserie:

```text
90116ba1f3294ccdc01a6df2f557abc431b66e0d feat(breeder-ai): add phase 0 technical spikes
eb011b5c3a2e5525cb6c3b4347107f84fd9245b7 ci(breeder-ai): validate phase 0 spike
fc1e25181311c160617db03375d29b609ff3601f docs(breeder-ai): record phase 0 results
```

Der vollständige Implementierungsdiff vor Erstellung dieses Berichts ist lokal abrufbar mit:

```text
git diff b272489dbd5c618d0e9f90e824afb353abdea3e6..fc1e25181311c160617db03375d29b609ff3601f
```

Der jeweils aktuelle vollständige Branch-Diff ist abzurufen mit:

```text
git diff main...HEAD
```

Der Bericht nennt absichtlich keinen eigenen zukünftigen Commit-Hash, damit sein Inhalt nicht selbstreferenziell wird.

---

## 18. Bewertung der aktuellen Architektur

Die bestehende Architektur ist für den nächsten kontrollierten Schritt tragfähig:

- die Runtime-Grenze ließ sich ohne Vermischung mit dem öffentlichen Breeder umsetzen;
- die dauerhafte Identity-Strategie funktioniert ohne E-Mail oder Transportindex;
- die Tenant-Grenze ist in Schema, Abfragen und Tests sichtbar;
- die Commit-/Retry-Invarianten sind mit echter lokaler D1-Technik darstellbar;
- die kanonische Species-Identität benötigt keine neue erfundene Domain-ID;
- Provider lassen sich hinter engen, nichtautoritativen Verträgen halten.

Es besteht kein technischer Grund, die Kernarchitektur vor dem nächsten Proof grundsätzlich zu ersetzen. Das bedeutet nicht, dass Phase 1 bereits freigegeben ist: Die externen Auth-/D1-/Providerannahmen und die finale Betriebstopologie bleiben Gates.

---

## 19. Empfehlung für Phase 1

Phase 1 erst nach einem expliziten Review dieses Spikes und nach einer neuen Freigabe beginnen.

Empfohlene Reihenfolge:

1. nichtproduktiven Live-Auth-Proof exakt eingrenzen und freigeben;
2. echte Access-JWT-/JWKS-Kette inklusive Rotation und Fail-closed-Verhalten prüfen;
3. reale Multi-Device- und Rebind-Fälle prüfen;
4. nichtproduktive Remote-D1-Migration, Backup und Restore beweisen;
5. Static-Assets-/API-Topologie entscheiden;
6. Phase-0-Verträge und Dokumentation anhand der Evidenz aktualisieren;
7. erst dann einen minimalen textbasierten Phase-1-Handler bauen;
8. reale Provider und Speech weiterhin getrennt behandeln.

Die erste Phase-1-Runtime sollte klein bleiben: AuthContext, ein Play-Space, minimaler typisierter Read-/Mutation-Pfad, Version-/Health-Information ohne Secrets und dieselben Commit-/Tenant-Invarianten.

---

## 20. Nächster konkreter Schritt und Stop

Nächster konkreter Schritt:

1. lokale Commit-Serie und diesen Bericht reviewen;
2. offene Fragen zu Access, JWKS, Provisioning, Rebind und Remote D1 festhalten;
3. gegebenenfalls einen separat begrenzten nichtproduktiven Live-Proof ausdrücklich freigeben.

Bis dahin:

- keine weitere Phase-1-Implementierung;
- kein Push;
- kein PR;
- kein Merge;
- kein Deployment;
- keine Cloud-/Secret-Änderung.

---

## 21. Einstieg für einen neuen Projektchat

Ein neuer Projektchat soll nicht allein diese Zusammenfassung übernehmen, sondern:

1. den aktuellen Repository-, Branch-, Remote- und Working-Tree-Zustand selbst prüfen;
2. `AGENTS.md` vollständig lesen;
3. `README.md` lesen;
4. `docs/BREEDER_AI_PREBUILD_CONTRACTS.md` lesen;
5. `docs/BREEDER_AI_CURRENT_BLUEPRINT.md` lesen;
6. `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md` lesen;
7. diesen Abschlussbericht lesen;
8. `apps/breeder-ai/README.md` und die betroffenen Implementierungsdateien lesen;
9. aktuelle externe Technik anhand von Primärquellen erneut verifizieren;
10. vor jeder Cloud-, Secret-, Push-, PR-, Merge- oder Deploymentaktion neue ausdrückliche Freigabe einholen.

Kurzstatus für die Übergabe:

```text
Breeder AI
Branch: codex/breeder-ai-phase0-spikes
Phase 0 local proofs: green
Tests: 33/33
Production runtime: none
Deployment: none
Cloud D1: none
Access/OTP live proof: open
Real providers: none
Class-C conflicts: none
Current gate: review before any Phase 1 or external change
```
