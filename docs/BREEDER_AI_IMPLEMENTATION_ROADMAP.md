# Breeder AI PWA – Implementation Roadmap & Handoff

**Stand:** 15. September 2026  
**Status:** Phase-0-Spike durch PR #10 auf `main` gemergt; lokaler Passive-Candidate-Folgeblock am Review-Stop vor Phase 1, Live-Infrastruktur oder Breeder-AI-Deployment

## 0. Zweck dieses Dokuments

Dieses Dokument ist der technische Handoff für einen späteren Implementierungsauftrag an ChatGPT Work, Codex oder einen neuen Maintainer-Chat.

Es baut auf der aktuellen Produktwahrheit in `docs/BREEDER_AI_CURRENT_BLUEPRINT.md` auf.

Bei Widersprüchen gilt folgende Reihenfolge:

1. aktuelle Repository-Regeln (`AGENTS.md` und relevante technische Handoffs);
2. `docs/BREEDER_AI_PREBUILD_CONTRACTS.md`;
3. `docs/BREEDER_AI_CURRENT_BLUEPRINT.md`;
4. dieses Implementierungsroadmap-Dokument;
5. spezialisierte ältere Konzeptdokumente wie PWA-, Planner- und Social-Architektur;
6. ältere Chatannahmen.

Dieser Fahrplan ist bewusst in Gates unterteilt. Keine spätere Phase darf durch ungeprüfte Annahmen aus einer früheren Phase technisch festgezurrt werden.

---

## 1. Ausgangslage

Bereits vorhanden:

- kanonische Breeding-Domain im Repository;
- deterministischer Breeder;
- read-only Breeding API / MCP;
- Pal Data Core im Ausbau;
- Passives-PWA;
- Architekturkonzept für privaten Multi-User-Bestand;
- Architekturkonzept für inventory-aware Planner;
- Architekturkonzept für spätere Social-Schicht.

Noch nicht vorhanden:

- Breeder-AI-PWA-Runtime;
- D1-Datenbank für Userstate;
- Auth-/Identity-Runtime;
- Speech-/Reasoning-Providerintegration;
- private Inventory API;
- Projekt-/Checkpoint-Runtime;
- Feedback-/Trace-Runtime;
- Showcase-/Social-Runtime;
- Deployment der neuen PWA.

Der bestehende öffentliche Breeder darf durch die neue Runtime nicht zu einer schreibenden oder user-state-haltenden API umgebaut werden.

Die Breeder-AI-Runtime wird in einem eigenen App-/Package-Bereich isoliert. Vorgesehener Zielbereich ist `apps/breeder-ai/`; die interne Aufteilung wird in Phase 0 festgelegt. Die historische Passives PWA bleibt zunächst unverändert im Root und wird nicht im Konzept-PR verschoben.

Vor dem ersten Runtime-Code gelten zusätzlich die vier verbindlichen Verträge aus `docs/BREEDER_AI_PREBUILD_CONTRACTS.md`: Runtime-/Repository-Grenze, dauerhafte Identitäten, Auth-/Tenant-Invarianten und Commit-/Retry-Semantik.

---

## 2. Implementierungsprinzipien

### 2.1 Erst Contracts, dann UI-Komfort

Vor visueller Ausgestaltung müssen folgende Verträge stabil sein:

- AuthContext;
- UserIdentity;
- PlaySpace;
- Inventory State;
- Pal Instance;
- Bulk Pool;
- Project / Checkpoint / Link;
- Action Envelope;
- Mutation Envelope;
- Trace Context;
- Feedback Report;
- Provider Interfaces.

### 2.2 Text-first vor Speech-first

Die erste technische End-to-End-Kette soll mit Texteingabe funktionieren.

Begründung:

- Speech bringt zusätzlich Audioformat-, Browser- und Providerprobleme;
- Intent-/Resolver-/Mutation-Fehler lassen sich mit Text leichter isolieren;
- die Businesslogik darf nicht von Speech abhängen.

Speech wird anschließend auf dieselbe Text-/Action-Pipeline gesetzt.

### 2.3 Kein LLM-Direktzugriff auf Persistenz

Provider erhält ausschließlich eng definierte Tools/Contracts.

Kein Tool:

- beliebiges SQL;
- beliebige `user_id`;
- GitHub-Schreibzugriff;
- Breeder-Datenänderung;
- Deployment;
- Secret-Ausgabe.

### 2.4 Kein frühzeitiges Social

Social wird im Datenfundament vorbereitet, aber nicht Teil des ersten lauffähigen Kernpfads.

---

## 3. Phase 0 – technische Spikes und Architektur-Gates

**Ziel:** Kritische Plattformannahmen beweisen, bevor echte Userdaten oder größere Runtime-Struktur entstehen.

### 3.1 Auth-/Identity-Spike

Zu beweisen:

1. Login per E-Mail-One-Time-Code/OTP;
2. serverseitig validierter Auth-Kontext;
3. Mapping auf stabile interne `user_id`;
4. gleiche `user_id` auf zweitem Gerät;
5. Self-Service-Wechsel auf neue E-Mail aus authentifizierter Sitzung;
6. Verifikation der neuen E-Mail;
7. `user_id` bleibt unverändert;
8. unbekannte/unerlaubte Identität erhält keinen fremden oder neuen autoritativen Bestand;
9. Admin-Recovery bleibt technisch getrennt.

Offen zu testen:

- genaue Cloudflare-Access-/Worker-Grenze;
- Static-Assets-/API-Aufteilung;
- JWT/Identity-Weitergabe;
- Allowlist vs. anwendungsseitiges Account-Mapping.

**Stop-Gate:** Keine echte Inventory-Runtime auf einer ungeklärten Auth-Annahme aufbauen.

### 3.2 D1-/Persistenz-Spike

Zu beweisen:

- User-Isolation;
- `play_space_id`-Scoping;
- atomare Mutation beziehungsweise sicherer Action-Commit;
- Revisionen;
- Idempotency;
- Mutation Log;
- einfache Restore-/Recoveryfähigkeit.

### 3.3 Provider-Spike

Bei Implementierungsbeginn aktuell prüfen, nicht aus altem Chatwissen übernehmen:

- verfügbares Reasoning-/Fast-Modell;
- strukturierte Ausgabe / Function Calling;
- aktuelle Free-Tier-Limits;
- Speech-to-Text-Verfügbarkeit;
- Audioformate;
- Custom Vocabulary / Kontextsteuerung;
- Datenschutz-/Retention-Einstellungen;
- Kostenrisiko.

Provider müssen über Adapter abstrahiert werden.

### 3.4 Entity-Resolver-Spike

Mindestens testen:

- DE-/EN-Namen;
- häufige Diktierfehler;
- exakte Aliasse;
- Fuzzy Match;
- echte Mehrdeutigkeit;
- Passiven;
- Pal-Formen;
- sichere Rückfrage bei Ambiguität.

**Exit-Kriterium Phase 0:** Auth, Persistenz, Provider und Resolver sind jeweils mit kleinen realen Proofs-of-Concept technisch tragfähig oder die Architektur wurde bewusst angepasst.

### 3.5 Lokales Ergebnis vom 14. und 15. September 2026

Der isolierte Spike liegt unter `apps/breeder-ai/`. Lokal bewiesen sind:

- RS256-Signatur- und Claimprüfung einer Access-artigen JWT gegen injizierte JWKS;
- qualifiziertes Identity-Mapping, stabile interne User-ID, autorisierter Rebind und E-Mail-unabhängige Identität;
- D1-Commit-/Retry-Semantik in Workerd/Miniflare einschließlich der sieben vorgeschriebenen Fälle, Parallelzustellung und Rollback einer später scheiternden Batch-Anweisung;
- User-/Play-Space-Isolation;
- kanonischer Species-Crosswalk mit Dataset-Bindung, DE/EN, Varianten, Ambiguität und sicheren Fuzzy-Kandidaten;
- kanonischer Passive-Crosswalk mit eigenem Reference-Space-Hash, 115 displaybaren Current-Build-Entities, exakten DE-/EN-Namen, realer DE-Ambiguität und sicheren Fuzzy-Kandidaten;
- Provider-Interfaces, strikte strukturierte Output-Grenze, Timeout-/Fehlervertrag und Test-Doubles.

Der in 3.4 geforderte Passive-Identity-/Resolver-Proof ist lokal erfüllt. Das vollständige offizielle Schema-2-Artefakt aus Run `34975314764` auf Commit `e28b6148f47ec2179f63de8c104664be8f31df73` bestätigt 3810 Main/Common-Source-Rows, 1905 konfliktfrei coalesced Entities, davon 115 `SortDisplayable` und 1790 `SortNotDisplayable`. Der historische Overlay mappt 102/102; 13 weitere aktuelle displaybare Entities bleiben offizielle Game Truth. Der veröffentlichte Key `{ namespace: "palworld.passive.source_row", value: sourceRow }` ist an den Reference-Space-Hash gebunden. Fuzzy-Treffer werden nicht persistiert; fremde Reference-Space-Hashes sind explizite Migrationsfälle. `data-passives.js.nr`, Arraypositionen, Rank, `sourceOrdinal` oder generierte IDs sind keine Domain-Identität. Die reale deutsche Ambiguität `Erleuchteter` bleibt erhalten.

Noch nicht live bewiesen sind OTP/Access-Policy, echter JWKS-Abruf und Rotation, zwei reale Geräte, E-Mail-Wechsel, Static-Assets-/API-Topologie, Remote D1 sowie reale Reasoning-/Speech-/Research-Provider. Deshalb sind die lokalen technischen Proofs für Auth, Persistenz, Species, Passive-Identity und Provider erfolgreich; das vollständige Phase-0-Gate bleibt wegen dieser externen Proofs bewusst offen. Passive-Wirkungs-/Vererbungssemantik bleibt eine getrennte spätere Data-Core-Domain. Es wurden keine Cloud-Ressourcen, Secrets oder Deployments verändert. Der Review-Stop gilt.

Der vollständige Abschluss- und Übergabebericht liegt in `docs/BREEDER_AI_PHASE0_COMPLETION_REPORT.md`.

---

## 4. Phase 1 – Core Runtime Skeleton

**Ziel:** Kleinster sicherer serverseitiger Multi-User-Kern ohne KI-Komfort.

### 4.1 Runtime-Grundstruktur

Einführen:

- API-/Worker-Struktur für private Runtime;
- AuthContext-Middleware;
- interne `user_id`;
- `play_space_id`;
- D1-Schema/Migrationen;
- Health-/Version-Endpunkt ohne Secrets.

### 4.2 Minimaler Datenkern

Mindestens:

```text
users
auth_identities
play_spaces
inventory_state oder normalisierte Kernobjekte
pal_instances
bulk_entries
projects
project_checkpoints
project_links
mutations
```

Die endgültige Normalisierung darf nach Phase-0-Spike gewählt werden. Stable IDs und Tenant-/Play-Space-Grenzen sind wichtiger als eine vorschnelle Tabellenoptimierung.

### 4.3 Multi-Tenant-Schutz

Pflichttests:

- User A kann User B nicht lesen;
- User A kann User B nicht schreiben;
- frei mitgesendete `user_id` wird ignoriert/abgewiesen;
- falscher `play_space_id`-Kontext überschreitet keine Berechtigung;
- Adminpfad ist getrennt;
- keine List-All-Users-Funktion für normale Clients.

### 4.4 Revision + Mutation Log

Jede autoritative Mutation:

- erhält `mutation_id`;
- erhält `trace_id`;
- prüft erwartete Revision;
- erhöht Revision;
- ist idempotent oder besitzt Idempotency-Key;
- hinterlässt nachvollziehbaren Logeintrag.

**Exit-Kriterium Phase 1:** Zwei Testnutzer können auf mehreren Geräten isolierten Zustand sicher lesen und verändern, ohne LLM oder Speech.

---

## 5. Phase 2 – Action Engine und Texteingabe

**Ziel:** Freie Texteingabe wird in strukturierte, sichere Actions übersetzt.

### 5.1 Reasoning Provider Adapter

Vorgesehene Schnittstelle sinngemäß:

```text
ReasoningProvider.interpret(input, context, toolSchemas)
```

Output muss schema-validiert werden.

### 5.2 Action-Taxonomie V1

Mindestens:

- `ADD_PAL_INSTANCE`
- `UPDATE_PAL_INSTANCE`
- `SET_KEEPER`
- `BULK_ADD`
- `BULK_REMOVE`
- `CREATE_PROJECT`
- `UPDATE_PROJECT`
- `BRANCH_PROJECT`
- `LINK_PAL_TO_PROJECT`
- `CREATE_CHECKPOINT`
- `PLANNER_REQUEST`
- `QUESTION_INTERNAL`
- `HYPOTHETICAL_SIMULATION`
- `SETTINGS_MUTATION`

Keine Action darf direkt freie SQL-/Repository-/Breeder-Schreibrechte besitzen.

### 5.3 Confirmation Policy

Rückfragen werden ausgelöst bei:

- Entity-Mehrdeutigkeit;
- fehlendem Zielobjekt;
- widersprüchlicher Aussage;
- riskanter/destruktiver Mutation;
- sonstigen Business-Rule-Hinweisen.

Normale sichere und eindeutige Mutation soll nicht unnötig bestätigt werden müssen.

### 5.4 Keine globale Autosave-Logik

Persistenz ist Folge einer Mutation-Action.

Questions, Planner und Simulation schreiben nicht automatisch in autoritativen State.

**Exit-Kriterium Phase 2:** Ein Nutzer kann über freie Texteingabe reale Inventory-/Projektaktionen ausführen, Ambiguitäten werden zuverlässig nachgefragt und keine Hypothese wird als realer Bestand gespeichert.

---

## 6. Phase 3 – Working Context, Recovery und Projektgraph

**Ziel:** Lange Workflows überleben Session-/Netz-/App-Probleme mit minimalem Arbeitsverlust.

### 6.1 Working Context

Einführen:

- aktives Projekt;
- letzte Planner-Route;
- offene Rückfrage;
- aktuelle Kandidaten;
- Mutation Draft;
- TTL/Retention.

### 6.2 Projekt-Checkpoints

Automatisch oder semiautomatisch an fachlichen Meilensteinen.

Keine komplette Chat-History erforderlich.

### 6.3 Projektgraph

`project_link` erlaubt:

- Branching;
- Wiederverwendung von Zwischenprodukten;
- später komplexere Abhängigkeiten.

Kein String-Pfad als fachliche Projektidentität.

### 6.4 Recovery-Test

Testfall:

1. Projekt starten;
2. Route erzeugen;
3. Zwischenprodukt bestätigen;
4. App/Session unterbrechen;
5. erneut anmelden;
6. sinnvoll am letzten Checkpoint weiterarbeiten.

**Exit-Kriterium Phase 3:** Längerer Projektworkflow verliert bei realistischer Unterbrechung nur temporären, nicht bestätigten Kontext und nicht den fachlichen Projektfortschritt.

---

## 7. Phase 4 – Speech-to-Text

**Ziel:** Sprache nutzt exakt dieselbe Action-/Resolver-Pipeline wie Text.

### 7.1 Browseraufnahme

Feature Detection für Audioaufnahme und Formate.

Kein Push-to-talk-Zwang; Ziel-UX:

- Mikrofon antippen;
- sprechen;
- stoppen/senden;
- optional Transkript kontrollieren.

### 7.2 Dynamisches Vokabular

Priorität:

- aktives Projekt;
- persönlicher Bestand;
- aktuelle Route;
- problematische Pal-/Passivnamen;
- DE-/EN-Aliasse.

Custom Vocabulary ist nur Hilfsmittel; Resolver bleibt Wahrheit.

### 7.3 Speech-Fehlerpfad

Transkriptionsunsicherheit muss von Entity-/Intent-Unsicherheit unterscheidbar bleiben.

**Exit-Kriterium Phase 4:** Häufige Palworld-Anfragen funktionieren per Sprache, und fehlerhafte Diktate führen nicht zu stillen falschen Mutationen.

---

## 8. Phase 5 – Inventory-aware Planner

**Ziel:** Der bestehende Breeder wird mit realem Userbestand systematisch kombiniert.

### 8.1 Harte Datenquellen

Planner verwendet:

- Breeder;
- Data Core;
- eigenen Inventory-State;
- Projects;
- validierte Zusatzregeln.

### 8.2 Bewertungsdimensionen

Mindestens:

- Generationen;
- vorhandene Eltern;
- fehlende Arten;
- Geschlechter;
- Passivträger;
- unerwünschte Passiven;
- IV-/Talentträger;
- Varianten;
- vorhandene Zwischenprodukte;
- Wiederverwendbarkeit.

Beschaffbarkeit wird nur bewertet, wenn valide Evidenz vorhanden ist.

### 8.3 Reasoning-Integration

Planner erzeugt valide Kandidaten; Reasoning-Modell bewertet und erklärt anhand Nutzerprioritäten.

**Exit-Kriterium Phase 5:** Für ein reales Ziel liefert das System nachvollziehbar eine Hauptroute und ernsthaft konkurrenzfähige Alternativen aus dem tatsächlichen Bestand.

---

## 9. Phase 6 – Kondensation, Erweckung und Schutzregeln

**Ziel:** Vollständigeres Pal-Management ohne erfundene Werte.

### 9.1 Bulk Pool

Mengenbasierte Überschusskopien, ohne Zwang zu individuellen Datensätzen.

Stern-/Kondensationszustände müssen so modelliert werden, dass spätere validierte Materialwertregeln abbildbar sind.

### 9.2 Keeper Hard Block

`keeper=true` ist verbindlicher Schutz für automatische Materialplanung.

### 9.3 Warnsystem

Warntrigger:

- Kondensationssterne;
- Erweckung;
- hochwertige validierte Passivkategorien;
- hoher IV-/Talent-Score;
- aktive Projektverwendung.

Temporäres `für diesen Vorgang nicht mehr warnen` ist erlaubt.

Expertenmodus kann Warnungen reduzieren/abschalten, aber Keeper-Semantik bleibt gesondert geschützt.

### 9.4 Offene Fachwerte zuerst validieren

Vor Implementierung explizit klären:

- Kondensationsmaterialregeln;
- Erweckungsschema;
- IV-Warnthreshold;
- Passivkategorien.

**Exit-Kriterium Phase 6:** Planner/Inventory können Sterne, Erweckung und Materialplanung nutzen, ohne hochwertige oder projektkritische Pals still zu verbrauchen.

---

## 10. Phase 7 – Feedback, Trace und Beta-Auswertung

**Ziel:** Reale Nutzung verbessert Produkt und Fehlerdiagnose ohne Vollchat-Logging.

### 10.1 Trace Pipeline

Jede Anfrage hat `trace_id`.

### 10.2 Problem melden

Nutzer kann eine fehlgeschlagene Interaktion gezielt melden.

Diagnosekontext wird strukturiert gespeichert; zusätzliche Inhalte/Transkripte nur transparent und datensparsam.

### 10.3 Improvement Signals

Reasoning-Modell darf nach erfolgreicher Rückfrage markieren, wenn ein wiederkehrender Workaround auf eine fehlende native Funktion hindeutet.

Signale werden aggregiert/reviewt, nicht automatisch als GitHub-Issue geschrieben.

### 10.4 Admin-/Maintainer-Workflow

Vorgesehen:

```text
private reports/signals
-> review
-> gruppieren
-> echte Bugs / Capability Gaps unterscheiden
-> bewusst Roadmap oder GitHub Issue aktualisieren
```

**Exit-Kriterium Phase 7:** Ein Nutzer kann problematische Interaktionen mit einem Klick reproduzierbar melden, und Maintainer können die relevante Pipeline ohne vollständige Chat-Historie nachvollziehen.

---

## 11. Phase 8 – Dynamischer Showcase

**Ziel:** Leichte motivierende Galerie ohne Kopie des Pal-Zustands.

### 11.1 Live-Referenz

Showcase verweist auf `pal_instance_id`.

Eigene Felder:

- `showcase_id`;
- Titel;
- kurze Beschreibung;
- Visibility;
- Zeitstempel.

Stats bleiben am echten Pal.

### 11.2 Slots

Startempfehlung 5 aktive Slots pro Nutzer; endgültige Grenze vor Implementierung festlegen.

### 11.3 Lösch-/Änderungsregeln

Wenn referenzierter Pal entfernt wird:

- warnen;
- Showcase kontrolliert deaktivieren oder entfernen;
- keine verwaisten öffentlichen Datensätze.

### 11.4 Historische Meilensteine

Später optional expliziter Snapshot, nicht Standardverhalten.

**Exit-Kriterium Phase 8:** Showcase aktualisiert sich bei Pal-Fortschritt dynamisch und erzeugt keine zweite fachliche Stats-Wahrheit.

---

## 12. Phase 9 – Social Foundation

**Ziel:** Optionaler Social-Bereich, ohne Kernabhängigkeit.

Erst nach stabilem Kern.

Mögliche Reihenfolge:

1. Profile / Nickname / Invite-Code;
2. mehrere sichtbare Play Spaces;
3. Server-/Gruppen-/Gildenzuordnung;
4. konkrete Breeding-Freigaben;
5. Reaktionen auf Showcase;
6. projektbezogene Breeding-Anfragen;
7. erst später freie Kommunikation evaluieren.

Alle Beziehungen referenzieren interne IDs.

Keine E-Mail als Social-ID.

Keine Freigabe bedeutet Materialfreigabe.

**Exit-Kriterium Phase 9:** Social kann abgeschaltet werden, ohne Planner/Inventory/Breeder zu beeinträchtigen.

---

## 13. Phase 10 – Beschaffbarkeit und Research

**Ziel:** Praktische Routenbewertung um valide Außenwelt-/Beschaffbarkeitsinformationen erweitern.

Nicht V1-blockierend.

Prioritätsreihenfolge:

1. sauber extrahierbare / versionierte Palworld-Daten;
2. persönliche Nutzerangaben;
3. optionaler ResearchProvider;
4. nie unbelegte Modellvermutung als Fakt.

Ein zukünftiger automatisierter Update-Workflow soll neue Spielversionen diffen und nur validierte Änderungen in Data-Core-Fakten übernehmen.

---

## 14. Testmatrix – verbindliche Kernfälle

Vor einem produktiven Friends-&-Family-Rollout mindestens:

### Auth / Isolation

- neuer Login;
- zweites Gerät;
- E-Mail-Wechsel;
- verlorene Sitzung;
- Cross-Tenant read/write blockiert;
- fremde `user_id` wirkungslos.

### Inventory

- Add/Update/Delete/Soft-Delete;
- Bulk +/-;
- Bulk -> konkrete Instanz;
- Revision conflict;
- idempotenter Retry;
- Keeper Hard Block.

### Sprache / Reasoning

- Deutsch;
- Englisch;
- gemischte Palworld-Namen;
- hypothetische Aussage;
- reale Bestandsaussage;
- Mehrdeutigkeit mit Rückfrage;
- falsche Entity darf nicht mutieren.

### Projekte

- Create;
- Update;
- Checkpoint;
- Branch;
- Zwischenprodukt wiederverwenden;
- Recovery nach Unterbrechung.

### Planner

- theoretische Route vs. Inventory Route;
- notwendiges Geschlecht;
- vorhandene Zwischenprodukte;
- Passiv-/IV-Carrier;
- keine erfundene Beschaffbarkeit.

### Feedback

- Trace erzeugt;
- Problem melden;
- Signal ohne PII-Überlogging;
- kein automatischer GitHub-Schreibzugriff.

---

## 15. Sicherheits- und Datenminimierungsregeln

- Keine Secrets im Client.
- Keine direkte D1- oder SQL-Funktion im LLM-Toolset.
- Keine frei wählbare Ziel-`user_id`.
- Keine automatische Veröffentlichung privater Bestände.
- Kein permanentes Vollchat-Logging als Standard.
- Audio nicht länger speichern als technisch/produktseitig nötig.
- Feedbackkontext minimal halten.
- Private Social-Daten standardmäßig geschlossen.
- Öffentliche Breeder-Domain bleibt getrennt von privatem State.

---

## 16. Nächster sicherer Arbeitsblock nach dem Phase-0-Review

Der Phase-0-Spike aus `codex/breeder-ai-phase0-spikes` wurde am 15. September 2026 durch PR #10 als Merge-Commit `b3e4daabeb4a6bbc3f132393d0898b0b3e45cea3` auf `main` übernommen. Die zugehörigen Push-Gates `Validate Palworld data` und `Breeder AI Phase 0 CI` waren grün. PR #10 führte kein Breeder-AI-/Cloudflare-Deployment durch. Der Merge auf `main` löste getrennt davon den bereits bestehenden GitHub-Pages-Workflow aus; dessen Run `34943406733` war erfolgreich. Das bedeutet **nicht**, dass Phase 0 als Gesamt-Gate abgeschlossen oder Phase 1 freigegeben ist.

Der Passive-Folgeblock liegt auf `breeder/passive-resolver-discovery`. Das bestätigende Schema-2-Artefakt aus Run `34975314764` auf Branch-HEAD `e28b6148f47ec2179f63de8c104664be8f31df73` wurde vollständig lokal ausgewertet. Darauf basieren die lokale kanonische Publikation und der Resolver; beide bleiben ungepusht.

Der nächste sichere Ablauf ist:

1. lokalen `main...HEAD`-Diff, Publikationsgrenze, kanonisches Artefakt, Resolver und Tests unabhängig prüfen;
2. offene externe Auth-/D1-/Provider-Gates weiterhin ausdrücklich sichtbar lassen;
3. Passive-Wirkungs-/Vererbungssemantik nicht mit dem bewiesenen Identity-Reference-Space vermischen;
4. Push, PR, Merge und jede Deploymententscheidung jeweils nur nach separater ausdrücklicher Freigabe durchführen.

### Stopppunkt

Bis zu einer neuen ausdrücklichen Freigabe:

- kein Start von Phase 1;
- kein Production-Deployment;
- keine Cloudflare-Access-/OTP-Änderung;
- keine Remote-D1-Erstellung oder -Migration;
- keine Secrets oder realen Reasoning-/Speech-/Research-Provider verbinden;
- keine Änderung des öffentlichen read-only Breeder-Vertrags.

---

## 17. Codex vs. Work – Entscheidung erst vor Start

Dieses Dokument legt nicht fest, ob die Umsetzung durch Codex oder Work erfolgt.

Vor Start soll anhand der dann aktuellen Fähigkeiten entschieden werden:

- Codex, wenn primär Repository-Code, Tests, Refactors und PR-Arbeit gefragt sind;
- Work, wenn zusätzlich Cloudflare-Dashboard-/Browser-/mehrstufige externe Konfigurationen sicher durchgeführt werden müssen.

Die Wahl darf die Architektur nicht verändern.

---

## 18. Deployment-Gates

Kein Production-Deployment, bevor mindestens:

1. Phase-0-Authmodell bewiesen;
2. D1-Migrationen reviewt;
3. Cross-Tenant-Tests grün;
4. Keeper-/Mutation-Schutztests grün;
5. Secrets nur serverseitig;
6. Rollback-/Backupweg dokumentiert;
7. Nutzer ausdrücklich Deployment freigegeben hat.

Ein reiner Architektur-/Testbranch darf keine unbeabsichtigte produktive Worker-Route ersetzen.

---

## 19. Dokumentationspflicht bei Umsetzung

Bei materieller technischer Änderung mindestens prüfen/aktualisieren:

- dieses Roadmap/Handoff-Dokument;
- `BREEDER_AI_CURRENT_BLUEPRINT.md` bei Architekturänderungen;
- spezifische PWA-/Planner-/Social-Dokumente;
- relevante Service-Handoffs, wenn API/MCP/Runtime wirklich geändert wurden;
- Root README bei sichtbarer Repositorystrukturänderung.

Ein Breeding-API-Handoff muss nicht allein deshalb geändert werden, weil private Planner-Architektur dokumentiert wurde. Erst materielle Änderungen an API/MCP/Worker/Datenvertrag machen das erforderlich.

---

## 20. Aktueller Phase-0-Review-Status

Aktueller Stand nach Merge von PR #10 und im lokalen Passive-Folgeblock:

```text
Breeder AI PWA
Status: Phase-0-Spike auf main gemergt; Passive Current-Build-Reference-Space und Resolver lokal implementiert; Review-Stop
Runtime: nur 503-Shell und technische Phase-0-Proofs, keine produktive Runtime
Deployment: kein Breeder-AI-/Cloudflare-Deployment; bestehender GitHub-Pages-Workflow lief nach main-Merge erfolgreich
D1: nur lokale Workerd-/Miniflare-Migration, keine Cloud-Datenbank
Access/Auth: lokale JWT-/Identity-Grenze bewiesen, Live-OTP/Policy/JWKS-Rotation offen
Provider: Interfaces und Doubles, kein realer Provider ausgewählt
Resolver: Species- und Passive-Identity-Proofs vorhanden; Passive-Wirkungs-/Vererbungssemantik getrennt offen
Next Gate: unabhängiger Review des lokalen Publikations-/Resolver-Diffs; jede Remote-Aktion nur nach ausdrücklicher Nutzerfreigabe
```

Phase 1, Live-Infrastruktur, reale Provider und Deployment bleiben bis zu einer separaten Freigabe ausdrücklich gesperrt.
