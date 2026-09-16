# Breeder AI – Pre-Build Contracts

**Stand:** 14. September 2026
**Status:** verbindliche Pre-Build-Verträge vor Phase 0; keine Runtime-Implementierung

## 0. Zweck und Vorrang

Dieses Dokument schließt die vier Pre-Build-Lücken aus dem unabhängigen Architecture Audit, bevor Breeder-AI-Runtime-Code entsteht.

Es präzisiert bestehende Architekturentscheidungen; es ersetzt weder den Current Blueprint noch die Phase-0-Spikes.

Für Breeder-AI-Implementierungsarbeit gilt bei Widersprüchen:

1. `AGENTS.md`;
2. dieses Dokument;
3. `docs/BREEDER_AI_CURRENT_BLUEPRINT.md`;
4. `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`;
5. spezialisierte ältere Konzeptdokumente.

Technischer Live-Zustand, kanonische Daten und getesteter Code haben für bereits implementierte Fakten weiterhin Vorrang vor Dokumentannahmen.

Diese Pre-Build-Contracts sind die verbindliche aktuelle Baseline für Phase 0, aber keine unumstößliche Architektur für alle späteren Phasen. Reale Spike-, Test- oder Implementierungsergebnisse dürfen eine heutige Annahme bewusst in Frage stellen. Eine solche Änderung darf jedoch weder still erfolgen noch bestehende Schutzmechanismen beiläufig umgehen: Der betroffene Vertrag und die zugehörigen Regeln/Architekturdokumente werden begründet angepasst, ersetzt oder enger gescoped; Auswirkungen auf Identitäten, Datenmigration, Tenant-Isolation, Commit-/Retry-Semantik, Kompatibilität, Tests, Rollback und Deployment werden ausdrücklich geprüft.

Damit gilt auch für B1–B4: Ihre Sicherheits- und Konsistenzziele bleiben verbindlich, solange sie nicht durch einen nachvollziehbaren neuen Architekturentscheid ersetzt werden. Historische Entscheidungen bleiben Provenienz; validierte neue technische Wahrheit darf sie kontrolliert superseden.

---

## B1 – Runtime- und Repository-Grenze

`MC-Micro/pal-tool` ist die öffentliche technische Heimat für Pal Data Core, kanonische Fachdomains, Breeder, gemeinsame Engines und darauf aufbauende Anwendungen.

Die Breeder AI ist die neue Hauptanwendung des Repository-Ausbaupfads. Ihre private Runtime wird als eigener App-/Package-Bereich isoliert. Der vorgesehene Zielbereich ist `apps/breeder-ai/`; die genaue interne Aufteilung wird in Phase 0 festgelegt.

Der bestehende öffentliche Breeder unter `services/breeding-api/` bleibt davon getrennt:

- read-only;
- stateless bezogen auf privaten Userstate;
- bestehender öffentlicher MCP bleibt read-only;
- keine D1-, Inventory-, Projekt-, Auth- oder LLM-Schreiblogik in `services/breeding-api/`;
- dessen MCP-/404-Regeln gelten nur für diesen öffentlichen Service und nicht automatisch für die private Breeder-AI-Runtime.

Breeder AI erhält für seine private Anwendung eine eigene Runtime-/Worker-/Binding-/Deployment-Konfiguration. Sie übernimmt nicht implizit Worker-, Secret-, Routing- oder Deployment-Konfiguration aus `services/breeding-api/`. Gemeinsame Infrastruktur darf später bewusst geteilt werden, aber nur über explizite Konfiguration und ohne Vermischung der beiden Runtime-Grenzen. Die konkrete Cloudflare-Topologie bleibt Gegenstand von Phase 0.

Die historische Palworld Passives PWA bleibt als eigenständiges, eingefrorenes Legacy-Side-Tool unter `apps/passives-pwa/` erhalten. Ihre kontrollierte physische Migration erfolgte getrennt von Phase 0; Reaktivierung, Hosting und Cache-/Service-Worker-Migration bleiben ausdrücklich kein Phase-0-Bestandteil.

Langfristiges Datenmodell für Consumer-Apps:

```text
offizielle Palworld-Daten
→ Technical Core
→ kanonische Domain-Daten / validierte Fachartefakte
→ app-spezifische generierte Consumer-Artefakte
→ Breeder AI / Passives PWA / weitere Tools
```

Consumer-Apps dürfen gemeinsame kanonische Daten verwenden, ohne UI-/Bewertungsmeinungen als Spielwahrheit in den Data Core zu schreiben.

`MC-Micro/pal-vault` und `MC-Micro/pal-control` bleiben getrennte Repositories und keine Build- oder Runtime-Pflichtabhängigkeit von `pal-tool`.

---

## B2 – Dauerhafte Identitäten und Domain-IDs

Namen sind Anzeige. Dauerhafte Beziehungen verwenden stabile IDs oder ausdrücklich versionierte Domain-Referenzen.

### App-Identitäten und Korrelations-IDs

Dauerhafte interne App-Identitäten umfassen insbesondere `user_id`, `auth_identity_id`, `play_space_id`, `pal_instance_id`, `project_id` und `mutation_id`.

- `auth_identity_id` ist die stabile interne Identität einer konkreten externen Login-Zuordnung.
- `mutation_id` identifiziert ein konkretes autoritatives Mutationsereignis.
- `trace_id` ist eine Korrelations-/Diagnose-ID für Request- und Workflow-Zusammenhänge und keine fachliche Domain-Identität.

E-Mail, Nickname, Displayname, Gerät, Session oder frei eingegebene Namen sind keine dauerhaften Schlüssel.

### Species-Identität in Phase 0

Für Phase 0 wird die bereits vorhandene kanonische interne Artkennung – aktuell `internal_name` beziehungsweise die entsprechende Game-Row-Identität – als namespaceter Species-Adapter-Key verwendet. Der Adapter-Key besteht semantisch aus einem ausdrücklich dokumentierten Species-Namespace und dem kanonischen internen Species-Wert; seine konkrete String-Serialisierung ist kein fachlicher Vertrag.

Dieser Adapter-Key ist ausdrücklich **nicht automatisch die endgültige globale Pal-Data-Core-ID**.

Verbindlich gilt:

- der heutige numerische `id`-Wert der öffentlichen Breeding API ist ein generierter/kompakter API-Index und darf **niemals** als dauerhafte `species_id` in privater Persistenz gespeichert werden;
- ebenso sind Paldecknummer, `internal_index`, `sourceOrdinal`, Arraypositionen und andere Build-/Generator-/Artefakt-Indizes keine dauerhaften Species-/Domain-Identitäten;
- Phase 0 verwendet stattdessen die bestehende kanonische interne Species-Kennung als namespaceten Adapter-Key;
- Dataset-/Reference-Version beziehungsweise Hash müssen den verwendeten Referenzraum nachvollziehbar machen;
- zwischen Runtime-Referenz und aktuellem Core-/Breeder-Datensatz existiert ein expliziter Crosswalk/Resolver;
- eine spätere Änderung einer internen Kennung löst keine automatische Fuzzy-, Namensähnlichkeits- oder Positionsmigration aus;
- ID-Änderungen werden ausschließlich über explizite, reviewbare Crosswalk-/Migrationsregeln übernommen;
- ein späteres endgültiges Core-ID-System darf den Phase-0-Adapter-Key kontrolliert ablösen, aber niemals durch eine stille Identitätsänderung.

Provider-/API-IDs und kanonische beziehungsweise adaptierte Domain-IDs bleiben getrennte Begriffe.

Für `passive_id` und weitere Domains gilt dieselbe Grundregel, aber es wird kein noch nicht belegter stabiler Schlüssel erfunden. Solange kein gleich belastbarer dauerhafter Domain-Key festgelegt ist, bleibt die Domain über einen ausdrücklich zu definierenden Crosswalk/Resolver offen; synthetische Testfixtures dürfen nicht zur produktiven Identität werden.

Unbekannt, nicht extrahiert und nicht anwendbar dürfen nicht still zu `0`, leerem String oder einer erfundenen Entity normalisiert werden.

---

## B3 – Auth-, Tenant- und Play-Space-Invarianten

Die konkrete Cloudflare-Access-/Identity-Topologie bleibt Gegenstand des Phase-0-Spikes. Folgende Sicherheitsinvarianten gelten jedoch bereits vor der technischen Wahl:

- `user_id` wird serverseitig aus einem validierten Auth-Kontext aufgelöst und niemals aus frei mitgesendeten Clientdaten übernommen;
- eine externe Login-Identität wird eindeutig über eine qualifizierte Provider-/Issuer-/Subject-Kombination gebunden: `provider / issuer + subject -> auth_identity_id -> user_id`;
- E-Mail-Adresse, Displayname, ein unqualifiziertes `subject`, Geräte-ID oder Session-ID sind keine dauerhafte Auth-Identität;
- eine erlaubte Auth-Identity darf nur gemäß einer ausdrücklich festgelegten Provisioning-Policy einer stabilen `user_id` zugeordnet oder neu provisioniert werden;
- unbekannte oder nicht erlaubte Identitäten dürfen keinen fremden Bestand erhalten und nicht still autoritativen Inventory-State erzeugen;
- alle privaten Objekte werden über den berechtigten Nutzer- und `play_space_id`-Kontext geprüft;
- Referenzen zwischen privaten Objekten dürfen keine Owner-/Play-Space-Grenze überschreiten, sofern eine spätere ausdrücklich entworfene Cross-Space-/Sharing-Funktion dies nicht erlaubt;
- ein Client kann durch Mitsenden fremder IDs keine Berechtigungsgrenze verändern.

Für Identity-Rebind gilt zusätzlich:

- der Rebind muss aus einem bereits authentifizierten und für die bestehende `user_id` autorisierten Kontext gestartet werden;
- allein der erfolgreiche Nachweis einer neuen externen Identity berechtigt niemals zur Übernahme einer bestehenden `user_id`;
- die neue externe Identity muss erfolgreich verifiziert sein;
- sie darf nicht bereits einer anderen `user_id` zugeordnet sein;
- gleiche, ähnliche oder geänderte E-Mail-Adressen dürfen keine automatische Account-Zusammenführung auslösen;
- die Umbindung erfolgt atomar;
- die bestehende interne `user_id` bleibt erhalten;
- die Behandlung der alten Identity und bereits bestehender Sessions muss ausdrücklich definiert und sicher umgesetzt werden;
- die konkrete Session-/Revocation-Technik richtet sich nach dem in Phase 0 tatsächlich gewählten Auth-Provider und wird hier nicht vorweggenommen;
- Admin-Recovery bleibt ein separater, stärker geschützter und nachvollziehbarer Pfad.

Phase 0 muss diese Invarianten mindestens mit positiven und negativen End-to-End-Proofs gegen die tatsächlich gewählte Auth-Technik beweisen.

---

## B4 – Commit-, Revision-, Idempotency- und Retry-Semantik

Für den Phase-0-Spike ist `state_revision` pro `user_id + play_space_id` die verbindliche Concurrency- und Commit-Grenze.

Jede autoritative Mutation:

- besitzt `mutation_id`;
- besitzt `trace_id`;
- besitzt einen davon getrennten `idempotency_key`;
- enthält `expected_state_revision`;
- prüft `expected_state_revision` vor dem Commit;
- erhöht bei Erfolg die `state_revision`;
- schreibt fachliche State-Änderung, neue `state_revision`, Mutation Log und Idempotency Receipt gemeinsam atomar beziehungsweise in einer nachweislich äquivalent sicheren Transaktion;
- erzeugt bei einem Revision-Conflict keines dieser Artefakte.

Dabei gilt ausdrücklich:

```text
idempotency_key != trace_id
```

- `trace_id` korreliert Request-/Workflow-Kontext für Diagnose und Nachvollziehbarkeit;
- `idempotency_key` identifiziert dieselbe konkrete Mutation über Netzwerk-Retries hinweg.

Retry- und Conflict-Semantik:

- `idempotency_key` ist innerhalb von `user_id + play_space_id` eindeutig;
- derselbe `idempotency_key` bleibt über Netzwerk-Retries derselben Mutation gleich;
- bei einem Retry wird zuerst ein vorhandenes Idempotency Receipt für denselben Nutzer-/`play_space_id`-Scope und Key geprüft; existiert eines, wird dessen gebundener normalisierter Payload vor einer neuen Revisionsprüfung verglichen;
- gleicher Key + gleicher normalisierter Payload + bereits erfolgreicher Commit liefert das bereits committed Ergebnis zurück und erzeugt keinen zweiten fachlichen Commit;
- zwei gleichzeitig eintreffende Requests mit demselben Key und demselben normalisierten Payload müssen auf dasselbe committed Receipt und Ergebnis konvergieren und dürfen niemals zwei fachliche Commits erzeugen;
- entsteht zwischen erster Receipt-Prüfung und Commitversuch parallel bereits dasselbe Receipt, muss die Implementierung den Receipt-Zustand erneut sicher auflösen; bei identischem normalisiertem Payload wird das bereits committed Ergebnis zurückgegeben statt eines zweiten fachlichen Commits;
- gleicher Key + anderer normalisierter Payload ist ein harter Conflict und darf weder als Retry noch als parallele Duplikatzustellung akzeptiert werden;
- ein Idempotency-Key ist an denselben Nutzer-/`play_space_id`-Scope und denselben normalisierten Action-/Mutation-Payload gebunden; das Receipt muss die dafür notwendige Payload-Bindung und das committed Ergebnis reproduzierbar tragen;
- nur wenn kein passendes bereits committed Receipt existiert, wird `expected_state_revision` für einen neuen Commit ausgewertet;
- falsche `expected_state_revision` ist ein expliziter Conflict/Stale-State-Fall und niemals Last-Write-Wins;
- bei einem Revision-Conflict werden weder fachlicher State noch Revision, Mutation Log oder Idempotency Receipt teilweise geschrieben;
- eine fachlich als atomar deklarierte Action-Gruppe committed vollständig oder gar nicht;
- implizite Teilcommits sind verboten; bewusst partielle Semantik müsste später als eigener Vertrag ausdrücklich modelliert werden.

Die Phase-0-Granularität `state_revision` pro `user_id + play_space_id` ist nicht automatisch die endgültige Produktionsgranularität. Nach erfolgreichem Phase-0-Review darf Phase 1 feinere Aggregate- oder Objektrevisionen einführen, wenn Architektur und Tests dies begründen und die Commit-/Retry-Invarianten erhalten bleiben.

Phase 0 muss mindestens Lost-Response-Retry, Duplicate-Retry, parallele Same-Key-Same-Payload-Zustellung, Same-Key-Different-Payload, Revision-Conflict und Action-Group-Rollback real gegen die gewählte Persistenztechnik testen.

---

## Pre-Build-Gate

Phase-0-Code darf auf diesen Verträgen aufbauen. Nicht erforderlich vor Phase 0 sind:

- fertige Produktions-Auth-Topologie;
- finales vollständiges D1-Schema;
- vollständiger Data Core aller Palworld-Domains;
- Speech, Social, Showcase, Mobility, Pal Modification oder IV-Improvement;
- Reaktivierung oder Deployment der historischen Passives PWA.

Phase 0 bleibt ein Spike-/Proof-Abschnitt. Mocks dürfen Schnittstellen vorbereiten, ersetzen aber nicht die im Implementation Roadmap geforderten realen Proofs.
