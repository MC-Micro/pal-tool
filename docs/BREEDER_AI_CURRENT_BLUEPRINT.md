# Breeder AI PWA – Current Blueprint

**Stand:** 14. September 2026  
**Status:** aktuelle konzeptionelle Entscheidungswahrheit; lokaler Phase-0-Spike unter `apps/breeder-ai/`, noch keine produktive Runtime und kein Deployment

## 0. Dokumentstatus und Vorrangregel

Dieses Dokument konsolidiert die nach Erstellung der ersten Architekturtexte weiter gereiften Produktentscheidungen aus der Konzeptarbeit am 14.09.2026.

Es ergänzt die bestehenden Detaildokumente:

- `docs/BREEDER_AI_PWA_ARCHITECTURE.md`
- `docs/BREEDING_PLANNER_ARCHITECTURE.md`
- `docs/BREEDER_AI_SOCIAL_ARCHITECTURE.md`

Die älteren Dokumente bleiben absichtlich erhalten, damit Detailgedanken, frühere Annahmen und die Entwicklung des Konzepts nachvollziehbar bleiben.

**Bei einem Widerspruch zwischen einem älteren Konzeptabschnitt und diesem Dokument hat dieses Current Blueprint Vorrang.** Ein späterer technischer Implementierungsstand kann diese Konzeption wiederum nur durch einen ausdrücklich dokumentierten Architekturentscheid ersetzen.

Insbesondere ersetzt dieses Dokument die frühere Idee eines globalen `Autosave`-Schalters durch eine typisierte Action-/Persistenzlogik und präzisiert Projektgraph, Recovery-Kontext, Feedback, Social-Grundlagen und die aktive Rolle des Reasoning-Modells.

---

## 1. Produktziel

Die Breeder AI PWA soll eine mobile-first, geräteübergreifende Friends-&-Family-Anwendung werden, die den bestehenden deterministischen Palworld-Breeder mit einem persönlichen Bestand, langfristigen Projekten und einer KI-gestützten Bedien- und Planungsschicht verbindet.

Das Ziel ist ausdrücklich **nicht** nur ein Chatbot und ausdrücklich **nicht** nur ein klassischer Zuchtrechner.

Das Zielbild ist:

```text
Palworld Data Core / Breeder
        = kanonische Spiel- und Zuchtwahrheit

Private User Runtime
        = persönlicher Bestand, Projekte, Checkpoints und Einstellungen

Planner Engines
        = deterministische / systematische Berechnung realer Optionen

Reasoning LLM
        = Sprache verstehen, Intent erkennen, Rückfragen stellen,
          Optionen bewerten, Projektkontext verarbeiten und erklären

PWA
        = einfache Oberfläche für Handy, Tablet, Laptop und PC
```

Ein Benutzer soll möglichst frei sprechen oder schreiben können. Die Software übersetzt natürliche Sprache in strukturierte, validierte Aktionen, ohne dem LLM selbst die Autorität über Spielwahrheit oder unkontrollierte Datenbankänderungen zu geben.

---

## 2. Harte Architekturgrenzen

Folgende Grenzen gelten als verbindlich:

1. Der öffentliche Breeder bleibt read-only und stateless.
2. Das LLM darf keine Zuchtbeziehungen, Pal-Entities, Passiven oder andere kanonische Fakten erfinden.
3. Das LLM schreibt niemals direkt in D1 oder andere Persistenz.
4. Private Userdaten werden nicht in Git gespeichert.
5. `MC-Micro/pal-tool` bleibt öffentliche technische Wahrheit für Data Core, Breeder, Planner-Logik und PWA-Code.
6. `MC-Micro/pal-vault` bleibt private Kontinuitäts-/Backupquelle und optionaler Speicher ausdrücklich dort gewünschter persönlicher Projekte, aber keine Pflichtabhängigkeit der Friends-&-Family-PWA.
7. `MC-Micro/pal-control` bleibt getrennt für Server-/Hoststeuerung.
8. Social-Funktionen dürfen den Kern aus Auth, Inventory, Projects, Resolver, Planner und Breeder nicht technisch voraussetzen oder ausbremsen.
9. Aktuelle externe Recherche darf niemals still zur kanonischen Spielwahrheit werden.
10. Keine Secrets, privaten Bestände oder authentifizierten URLs werden im Repository dokumentiert.
11. `pal-tool` wird evolutionär restrukturiert und nicht durch ein neues Repository ersetzt. Die Git-Historie bleibt als technische Provenienz erhalten.
12. Breeder AI ist der zentrale neue Anwendungsausbau. Die historische Passives PWA bleibt als eigenständiges Side-Tool erhalten und wird erst in einem getrennten Refactor kontrolliert aus dem Repository-Root migriert.
13. Consumer-Apps sollen langfristig dieselben kanonischen Data-Core-/Domain-Daten nutzen; app-spezifische Bewertungen und redaktionelle Overlays bleiben von Spielwahrheit getrennt.

Die verbindlichen Pre-Build-Grenzen für Runtime-Isolation, dauerhafte IDs, Auth/Tenant-Invarianten und Commit/Retry-Semantik stehen in `docs/BREEDER_AI_PREBUILD_CONTRACTS.md`.

---

## 3. Rollen der einzelnen Intelligenz- und Regelkomponenten

### 3.1 Speech-to-Text Provider

Aufgabe:

- Audio in Text überführen;
- DE/EN unterstützen;
- kontextuelles Palworld-Vokabular verwenden, soweit der gewählte Provider dies unterstützt.

Der Transcriber entscheidet nicht über Spielwahrheit und darf nicht unmittelbar mutieren.

### 3.2 Reasoning LLM als aktiver Orchestrator

Das Reasoning-Modell ist nicht nur Antwortgenerator am Ende, sondern arbeitet **vor und nach** den deterministischen Komponenten.

Vor Resolver/Engines:

- Intent erkennen;
- reale Aussage vs. Hypothese vs. Frage vs. Projektaktion unterscheiden;
- erwähnte Entities extrahieren;
- fehlende Informationen erkennen;
- bei echter Mehrdeutigkeit gezielte Rückfragen stellen;
- strukturierte Actions vorbereiten.

Nach Resolver/Engines:

- valide Alternativen vergleichen;
- Engpässe erkennen;
- Nutzerprioritäten berücksichtigen;
- Rückfragen zu Tradeoffs stellen;
- Planner-Ergebnisse verständlich erklären;
- Feedback-/Improvement-Signale semantisch klassifizieren.

Grundregel:

```text
Semantik und Abwägung -> Reasoning LLM
Kanonische Wahrheit -> Resolver / Data Core / Breeder
Zustandsänderung -> serverseitige Action-/Mutation Engine
```

### 3.3 Palworld Entity Resolver

Der Resolver validiert und normalisiert gegen kanonische Daten:

- Pal-Arten und Formen;
- interne IDs;
- deutsche und englische Namen;
- Passiven und bekannte Lokalisierungen/Aliasse;
- Geschlecht;
- Varianten;
- später weitere strukturierte Domain-Entities.

Fuzzy Matching darf Kandidaten liefern, aber bei echter Mehrdeutigkeit keine destruktive oder irreversible Mutation auslösen.

### 3.4 Breeder und Data Core

Sie bleiben die fachliche Wahrheit für bekannte strukturierte Palworld-Daten und Zuchtbeziehungen.

Der Breeder entscheidet nicht über persönliche Verfügbarkeit, Keeper, Projekte oder Social-Freigaben.

### 3.5 Planner Engines

Planner berechnen systematisch reale Optionen und Scores anhand validierter Daten.

Das LLM darf Ergebnisse bewerten, erklären und Prioritäten interpretieren, aber nicht eine nicht vorhandene Route erfinden.

---

## 4. Intent- und Action-Modell – kein globales Autosave

Die frühere Idee eines globalen `Autosave AN/AUS` wird verworfen.

Persistenz ist Teil der jeweiligen Aktion.

Beispiele:

```text
"Ich habe 4 neue Surfent."
-> INVENTORY_BULK_ADD
-> validieren
-> persistieren

"Was wäre, wenn ich einen weiblichen Surfent mit Legend hätte?"
-> HYPOTHETICAL / SIMULATION
-> keine autoritative Bestandsmutation

"Mach daraus ein neues Projekt."
-> CREATE_PROJECT oder BRANCH_PROJECT
-> persistieren
```

### 4.1 Grundregel

**Mutationen werden gespeichert. Denken, Fragen und Simulationen werden nicht automatisch zu fachlicher Wahrheit.**

Eine temporäre Überlegung kann durch eine spätere ausdrückliche Aktion wie `als Projekt speichern`, `übernehmen` oder `setz das so um` persistent werden.

### 4.2 Vorgesehene Intent-Klassen

Mindestens folgende semantische Klassen sind vorgesehen:

- `INVENTORY_MUTATION`
- `PAL_INSTANCE_MUTATION`
- `PROJECT_CREATE`
- `PROJECT_UPDATE`
- `PROJECT_BRANCH`
- `PROJECT_LINK`
- `PLANNER_REQUEST`
- `HYPOTHETICAL_SIMULATION`
- `QUESTION_INTERNAL`
- `QUESTION_REASONING`
- `RESEARCH_REQUEST`
- `SETTINGS_MUTATION`
- `SHOWCASE_MUTATION`
- spätere `SOCIAL_ACTION`

Eine Nutzeräußerung darf mehrere Actions erzeugen.

Beispiel:

```text
"Ich habe jetzt einen weiblichen Surfent mit Legend und guten IVs.
 Behalte den und nimm ihn für mein Elphidran-Aqua-Projekt."
```

kann nach Validierung zu einer atomaren oder kontrolliert sequenziellen Action-Gruppe werden:

1. `ADD_PAL_INSTANCE`
2. `SET_KEEPER`
3. `LINK_PAL_TO_PROJECT`
4. `UPDATE_PROJECT_STATE`

### 4.3 Rückfragen als normaler Teil des Systems

Rückfragen sind kein Ausnahmefehler.

Wenn natürliche Sprache oder der Bestand mehrere plausible Interpretationen zulassen, soll das Reasoning-Modell gezielt nachfragen.

Beispiel:

```text
"Mach den guten Surfent zum Keeper."
```

Wenn mehrere Surfent plausibel gemeint sein können, darf keine zufällige Instanz verändert werden. Das Modell erhält validierte Kandidaten und fragt den Nutzer nach der richtigen Instanz.

---

## 5. Persistenzebenen und Recovery gegen Context Loss

Es werden drei verschiedene Zustandsarten unterschieden.

### 5.1 Autoritativer Projekt-/Inventory-State

Dauerhaft und fachlich verbindlich.

Beispiele:

- vorhandene konkrete Pals;
- Bulk-Mengen;
- Keeper;
- Projektziele;
- Projektverknüpfungen;
- bestätigte Einstellungen.

### 5.2 Working Context

Kurzfristiger server- oder sessionspezifischer Arbeitskontext, damit Folgeformulierungen funktionieren.

Kann enthalten:

- aktives Projekt;
- aktuelle Planner-Anfrage;
- zuletzt berechnete Route;
- ausgewählte Alternative;
- gerade erwähnte Entities;
- offene Rückfrage;
- noch nicht ausgeführter Mutation-Entwurf.

Dieser Kontext darf mit TTL/Retention versehen und später automatisch entfernt werden.

### 5.3 Project Checkpoints

Wiederherstellbare Zwischenstände langfristiger Projekte.

Sinnvolle Checkpoints entstehen an fachlichen Meilensteinen, zum Beispiel:

- Ziel definiert;
- Route ausgewählt;
- wichtiges Zwischenprodukt erreicht;
- Projekt verzweigt;
- Planner-Strategie gewechselt.

Das Ziel ist geringer Arbeitsverlust bei App-Abbruch, Netzfehler, Modellfehler oder Sessionverlust, ohne eine komplette permanente Chat-History aufzubauen.

---

## 6. Projekte als Graph statt Chatverlauf oder String-Pfad

Eine vollständige Chat-History ist kein Primärartefakt der Anwendung.

Stattdessen werden Projekte strukturiert gespeichert.

Ein Projekt kann mindestens enthalten:

- Zielart;
- gewünschte Passiven;
- unerwünschte Passiven;
- IV-/Talentziele;
- Variantenanforderungen;
- Prioritäten;
- Ausgangslage;
- aktuelle Route;
- erreichte Zwischenprodukte;
- nächster sinnvoller Schritt;
- Status und Checkpoints.

### 6.1 Projektverzweigungen

Ein Nutzer kann an einem Checkpoint ein neues Projekt starten.

Beispiel:

```text
Projekt A
  |
  +-- Checkpoint 17
        |
        +--> Projekt B
        +--> Projekt C
```

### 6.2 Kein starrer Ordnerpfad

Projektrelationen sollen nicht als String wie

```text
A/Route2/B/TeilprojektC
```

gespeichert werden.

Stattdessen werden stabile IDs und Relationseinträge verwendet.

Konzeptionell:

```text
project
- project_id
- owner_user_id
- play_space_id

project_checkpoint
- checkpoint_id
- project_id

project_link
- project_link_id
- source_project_id
- source_checkpoint_id
- target_project_id
- relation_type
```

Dadurch können später auch mehrere Projekte dieselben Zwischenprodukte oder Ergebnisse wiederverwenden, ohne eine starre Baumannahme.

---

## 7. Stabile interne IDs als Zukunftsgrundlage

Namen sind Anzeige. IDs sind Identität.

Vorgesehene stabile Referenzen:

```text
user_id
auth_identity_id
play_space_id
group_id
pal_instance_id
bulk_entry_id
project_id
checkpoint_id
project_link_id
showcase_id
thread_id
message_id
mutation_id
trace_id
feedback_id
signal_id
```

Dazu kommen kanonische Palworld-Domain-IDs wie `species_id`, `passive_id` usw.

### 7.1 Domain-ID vs. konkrete Instanz

```text
species_id
= Was ist Elphidran Aqua?

pal_instance_id
= Welches konkrete Elphidran Aqua dieses Nutzers ist gemeint?
```

Diese Ebenen dürfen niemals vermischt werden.

### 7.2 Veränderbare Werte sind keine Schlüssel

Folgende Werte dürfen keine dauerhaften Primär-/Fremdschlüssel sein:

- E-Mail;
- Nickname;
- Displayname;
- Geräte-ID;
- Session-ID;
- frei eingegebener Palname.

---

## 8. Identity, Login, E-Mail-Wechsel und Recovery

### 8.1 Stabile Nutzeridentität

Jeder Nutzer besitzt eine serverseitig erzeugte unveränderliche `user_id`.

E-Mail-Adresse, Nickname und Geräte werden lediglich zugeordnet.

### 8.2 Geplantes Login-Ziel

Für Friends & Family ist weiterhin ein einfacher E-Mail-One-Time-Code/OTP-Weg vorgesehen, ohne eigene Passwortdatenbank.

Die genaue Cloudflare-Access-/Identity-Integration wird **nicht** vor einem Phase-0-End-to-End-Spike als endgültige Implementierungswahrheit festgeschrieben.

### 8.3 Self-Service-E-Mail-Wechsel

Produktanforderung:

1. Nutzer ist bereits authentifiziert.
2. Nutzer gibt neue E-Mail an.
3. Verifikationscode geht an die neue E-Mail.
4. Nach erfolgreicher Verifikation wird die Auth-Identity neu zugeordnet.
5. `user_id` bleibt unverändert.
6. Inventory, Projekte, Showcase, Reaktionen und spätere Threads bleiben unverändert.

Bei vollständigem Verlust von Sitzung und alter Login-Identität bleibt ein getrennt abgesicherter Admin-Recoveryweg vorgesehen.

---

## 9. `play_space_id` als vorbereitete Multi-World-/Server-Grenze

Eine fundamentale Zuordnung nur auf `user_id` wäre langfristig zu eng.

Bestand und Projekte sollen von Anfang an einen `play_space_id` besitzen.

Ein Play Space kann später sein:

- Dedicated Server;
- Friends-&-Family-Server;
- Singleplayer-Welt;
- Testwelt;
- weitere logisch getrennte Spielstände.

Für V1 kann pro Nutzer automatisch ein einziger Standard-Play-Space entstehen und in der Oberfläche zunächst weitgehend unsichtbar bleiben.

Ziel:

```text
user_id + play_space_id
```

bilden den persönlichen Spielkontext, ohne spätere Migration aller Pals und Projekte erzwingen zu müssen.

Ob und wann Nutzer in V1 tatsächlich mehrere sichtbare Play Spaces anlegen können, bleibt Implementierungsentscheidung der entsprechenden Phase.

---

## 10. Inventory-Modell

### 10.1 Konkrete relevante Pals

Ein individuell relevantes Pal wird als konkrete Instanz geführt.

Mindestens vorgesehene Attribute:

```text
pal_instance
- pal_instance_id
- owner_user_id
- play_space_id
- species_id
- gender
- passives[]
- ivs/talents optional
- variant flags optional
- condensation_stars
- awakening_state optional / validiert
- keeper boolean
- tags optional
- note optional
- revision
- created_at
- updated_at
```

Ein konkretes Exemplar wird individuell geführt, sobald es für den Nutzer relevant ist, etwa wegen:

- guter IVs/Talente;
- wertvoller Passiven;
- sauberem/blankem Breeding-Carrier;
- Lucky/Alpha/Variante;
- Zwischenprodukt;
- persönlichem Favoriten;
- geplantem Main/Mount;
- Projektbezug;
- sonstigem bewusstem Keeper-Grund.

### 10.2 Bulk-/Kopienpool

Nicht relevante Massenkopien werden nicht künstlich zu hunderten Einzelinstanzen.

Konzeptionell wird ein neutraler `bulk_pool` beziehungsweise Kopienpool verwendet.

Die Bezeichnung `material_pool` wird vermieden, weil eine nicht individuell gepflegte Kopie nicht automatisch bedeutet, dass sie fachlich oder sozial bereits zur Verwendung freigegeben ist.

Bulk-Einträge können mengenbasiert geführt werden. Kondensationssterne müssen perspektivisch berücksichtigt werden, weil bereits kondensierte Kopien einen anderen Materialwert besitzen können.

Der genaue Materialwert wird **nicht geraten** und erst aus validierten Kondensationsregeln umgesetzt.

Eine Bulk-Kopie kann jederzeit zu einer konkreten `pal_instance` hochgestuft werden.

### 10.3 Erweckung

Der Erweckungszustand gehört als optionales strukturiertes Feld in den individuellen Pal-Datensatz.

Gültige Werte, interne Repräsentation und Patchabhängigkeit werden erst anhand verifizierter Spieldaten implementiert.

---

## 11. Keeper- und Materialschutz

`keeper=true` ist eine **Schutzflag**, keine Qualitätswertung.

### 11.1 Hard Block

Ein Keeper darf von automatischen Material-/Verbrauchsvorschlägen nicht als zu verbrauchendes Exemplar eingeplant werden.

### 11.2 Warntrigger für Nicht-Keeper

Auch ein Nicht-Keeper kann schützenswert wirken.

Warntrigger sollen unter anderem berücksichtigen:

- Kondensationssterne;
- Erweckungsstatus;
- hochwertige Diamond-/Rainbow-/Weltenbaum-Passiven nach validierter Klassifikation;
- hohe IV-/Talentqualität;
- aktive Verwendung in einem Projekt;
- weitere später validierte seltene/hochwertige Flags.

Für IVs/Talente soll bevorzugt ein einfacher Gesamtwert-/Score-Breakpoint genutzt werden statt vieler Einzelregeln.

**Der konkrete Grenzwert ist noch offen.** Diskutierter Bereich: grob Summe aus drei Einzelwerten im Bereich von `3 x 75` bis `3 x 85`; Werte wie 240 oder etwa 250 wurden als mögliche Breakpoints diskutiert, sind aber nicht beschlossen.

### 11.3 Warnunterdrückung

Vorgesehen:

- Warnung normal anzeigen;
- `für diesen Vorgang / diese Session nicht mehr warnen` als temporäre Ausnahme;
- keine dauerhafte Pair-/Species-Ausnahme durch einen beiläufigen Klick;
- zusätzliche Experteneinstellung, um Materialschutzwarnungen bewusst zu reduzieren oder auszuschalten.

Die Expertenoption darf `keeper=true` nicht in einen automatischen Materialfreigabestatus umwandeln, solange kein später bewusst anders definierter Modus beschlossen wird.

---

## 12. Mutation Log, Revisionen und Traceability

Jede relevante Zustandsänderung soll nachvollziehbar sein.

### 12.1 Mutation Log

Konzeptionell:

```text
mutation
- mutation_id
- user_id
- play_space_id
- trace_id
- action_type
- target_type
- target_id
- before_revision
- after_revision
- created_at
```

Ziele:

- Debugging;
- nachvollziehbare Bestandsänderungen;
- spätere Undo-/Recovery-Funktionen;
- Idempotency;
- Verbindung von Nutzeranfrage und tatsächlicher Mutation.

### 12.2 Revisionen

Server-State ist autoritativ.

Schreibvorgänge dürfen veraltete Revisionen nicht blind überschreiben. Mehrgerätebetrieb benötigt optimistische Konflikterkennung.

### 12.3 Trace IDs

Jede Nutzerinteraktion beziehungsweise Verarbeitungskette erhält eine `trace_id`.

Damit kann eine Verarbeitung logisch verbunden werden:

```text
trace_id
  |- Eingabe / Transkript
  |- Intent-Auswertung
  |- Rückfragen
  |- Entity Resolution
  |- Breeder-/Planner-Aufrufe
  |- Mutation(en)
  |- Antwort
  |- Feedbackreport / Improvement Signal
```

---

## 13. Feedback, Beta-Lernen und Improvement Signals

### 13.1 Nutzerfeedback

Die PWA soll eine einfache Funktion wie `Problem melden` bieten.

Ein Feedbackreport darf strukturierten Diagnosekontext enthalten, zum Beispiel:

```text
feedback_report
- feedback_id
- trace_id
- app/schema version
- request_type
- interpreted_intent
- relevante Resolver-/Planner-Ergebnisse
- failure category
- optional user comment
- consented input/transcript context optional
- status
- created_at
```

Private Eingaben oder Sprachtranskripte sollen nicht unnötig dauerhaft geloggt werden. Wenn zusätzlicher Nutzerinhalt für einen Bericht mitgesendet wird, soll dies transparent sein.

### 13.2 Fehlerkategorien

Beispiele:

- `TRANSCRIPTION_FAILED`
- `INTENT_AMBIGUOUS`
- `ENTITY_NOT_FOUND`
- `ENTITY_AMBIGUOUS`
- `ACTION_NOT_SUPPORTED`
- `VALIDATION_FAILED`
- `PLANNER_NO_ROUTE`
- `MODEL_RESPONSE_ERROR`
- `MISSING_CAPABILITY`

### 13.3 Rückfragen sind nicht automatisch Fehler

Normale Ambiguität soll nicht für jede Rückfrage einen administrativen Bericht erzeugen.

Nach erfolgreicher Klärung darf das Reasoning-Modell aber semantisch beurteilen, ob:

1. lediglich normale natürliche Mehrdeutigkeit vorlag; oder
2. die Anfrage nur über einen unnötigen Umweg lösbar war, weil eine native Capability fehlt.

Im zweiten Fall kann ein leichtgewichtiges `improvement_signal` erzeugt werden.

Konzeptionell:

```text
improvement_signal
- signal_id
- trace_id
- category
- interpreted_intent
- missing_capability
- workaround_used
- clarification_count
- resolved_successfully
- confidence
- optional project_id
- created_at
```

Diese Signale dürfen keine automatischen GitHub-Issues oder Codeänderungen auslösen.

Vorgesehener Weg:

```text
PWA Runtime
-> private Feedback-/Signal-Daten
-> Admin/Review
-> bei echtem Bedarf bewusstes GitHub-Issue / Roadmap-Update
```

---

## 14. Planner, Fragen und Research

### 14.1 Interne beantwortbare Fragen

Fragen, die mit unseren validierten Quellen beantwortbar sind, benötigen keine Webrecherche.

Beispiele:

- Ergebnis einer Zuchtpaarung -> Breeder;
- welche eigenen Pals eine Passive tragen -> Inventory;
- welche Route die wenigsten neuen Arten benötigt -> Planner + Inventory + Breeder.

### 14.2 Reasoning-Fragen

Das LLM darf validierte Daten vergleichen, Tradeoffs erklären und Nutzerprioritäten interpretieren.

Es darf fehlende aktuelle Palworld-Fakten nicht mit Modellwissen auffüllen.

### 14.3 Externe aktuelle Recherche

Live-Research wird **nicht als V1-Voraussetzung** betrachtet.

Die Architektur soll eine Provider-Grenze vorbereiten:

```text
ResearchProvider
- disabled
- future provider A
- future provider B
- future validated internal source
```

Wenn eine Anfrage externe Aktualität erfordert und kein ResearchProvider aktiv ist, muss das System den nicht bewerteten Aspekt offen benennen.

Beispiel:

```text
"Route A ist züchterisch kürzer. Die aktuelle Beschaffbarkeit
 der fehlenden Eltern wurde nicht bewertet."
```

### 14.4 Bevorzugte Langzeitstrategie

Wenn der Pal Data Core später Spawn-, Ei-, Händler-, Boss- oder ähnliche Beschaffungsdaten zuverlässig extrahieren kann, ist eine versionierte, patchvalidierte interne Datenpipeline einer rein freien Webrecherche vorzuziehen.

Ein zukünftiger Update-Workflow kann sein:

```text
neues Palworld-Update
-> Daten neu extrahieren
-> Diff gegen vorherige Version
-> Schema-/Plausibilitätsprüfung
-> auffällige Änderungen zur Review
-> validierter neuer Data Core
```

---

## 15. Dynamischer Showcase statt Standard-Snapshot

Die frühere Standardidee eines eingefrorenen Showcase-Snapshots wird geändert.

Der bevorzugte Showcase ist **dynamisch** und referenziert die echte private `pal_instance`.

Es werden keine IVs, Passiven, Sterne oder Erweckungswerte als zweite fachliche Kopie angelegt.

Konzeptionell:

```text
showcase_entry
- showcase_id
- owner_user_id
- pal_instance_id
- title optional
- description optional
- visibility
- created_at
- updated_at
```

Beim Anzeigen werden die aktuellen freigegebenen Pal-Werte live aus der referenzierten Instanz gelesen.

### 15.1 Vorteile

- keine veralteten Statistik-Kopien;
- kein Snapshot-Datenmüll;
- Änderungen am Pal werden im Showcase automatisch sichtbar;
- Showcase-Metadaten bleiben sauber von Inventory-Fakten getrennt.

### 15.2 Titel und Beschreibung

Titel und kurze Beschreibung sind ausdrücklich erwünscht und gehören zum Showcase-Eintrag, nicht zum Pal selbst.

Exakte Zeichenlimits werden erst bei UI-Design festgelegt.

Strukturierte Stats sollen nicht unnötig als duplizierter Freitext gespeichert werden.

### 15.3 Begrenzte aktive Slots

Showcase soll eine Galerie bleiben und nicht zur zweiten Palbox werden.

Startempfehlung: **5 aktive Showcase-Slots pro Nutzer**.

Die konkrete Produktgrenze 5 vs. 10 ist noch nicht endgültig beschlossen und kann vor Social-Implementierung angepasst werden.

### 15.4 Meilenstein-Snapshots später optional

Ein expliziter zukünftiger Befehl wie `Meilenstein festhalten` kann bewusst einen eingefrorenen historischen Snapshot erzeugen.

Das ist getrennt vom normalen Live-Showcase.

---

## 16. Social-Zukunftsschicht

Social bleibt technisch optional und außerhalb der ersten Kernimplementierung.

Sie soll jedoch durch stabile IDs und `play_space_id` vorbereitet werden.

Mögliche spätere Bereiche:

- Nickname/Handle und Displayname;
- Friend-/Invite-Code;
- Play-Space-/Servermitgliedschaft;
- Gruppen/Gilden;
- freiwillige Breeding-Freigaben;
- dynamische Showcases;
- Likes/Reaktionen;
- projektbezogene Breeding-Anfragen;
- später gegebenenfalls Direktkommunikation.

### 16.1 Stabile Social-Identität

Alle Beziehungen referenzieren `user_id`, niemals Nickname oder E-Mail.

### 16.2 Breeding-Freigabe ist keine Materialfreigabe

Ein fremder oder freigegebener Pal darf niemals automatisch als Kondensations-/Verbrauchsmaterial interpretiert werden.

### 16.3 Kommunikation

Bevor ein freier Chat gebaut wird, werden kontextbezogene Aktionen bevorzugt, etwa:

```text
"Kann ich deinen Surfent für Projekt X nutzen?"
"Breeding-Anfrage angenommen"
Reaktion auf Showcase
```

Der Kern muss ohne Social vollständig funktionieren.

---

## 17. Offline und Multi-Device – aktueller Architekturvorschlag

Dieser Punkt ist noch nicht ausdrücklich als finale Produktentscheidung bestätigt, wird aber als technischer Default empfohlen.

- Serverzustand ist autoritative Wahrheit.
- Letzten bekannten Bestand/Projekte offline ansehen ist möglich.
- Eingaben/Entwürfe können lokal gehalten werden.
- Eine Mutation gilt erst als committed, wenn der Server sie bestätigt.
- Keine stillen destruktiven Offline-Mutationen mit späterer unkontrollierter Mehrgeräte-Zusammenführung in V1.
- Revisionen verhindern blindes Überschreiben älteren Zustands.

Vor Implementierung wird entschieden, welche Offline-Komfortfunktionen tatsächlich V1 erreichen.

---

## 18. Noch offene Produkt-/Fachentscheidungen

Folgende Punkte sind bewusst **nicht** als fertige Spielwahrheit einzubauen:

1. finaler IV-/Talent-Warnthreshold für Materialschutz;
2. kanonische Klassifikation der Diamond-/Rainbow-/Weltenbaum-Passiven für Warnregeln;
3. exakte Kondensations-/Materialwertregeln je aktuellem Patch;
4. exakte Erweckungsdaten und internes Schema;
5. 5 vs. 10 aktive Showcase-Slots;
6. konkreter Umfang von Offline-Funktionen in V1;
7. konkrete Cloudflare-Access-/OTP-Integration nach Phase-0-Spike;
8. finaler LLM-/Speech-Provider und aktuelle Free-Tier-/Quota-Limits bei Implementierungsbeginn;
9. ob V1 mehrere sichtbare Play Spaces unterstützt oder nur einen vorbereiteten Standardspace;
10. wann und über welche validierte Datenquelle Beschaffbarkeit in Planner-Scores einfließt.

Offene Werte dürfen im Code nicht durch Erinnerungswissen oder Schätzwerte ersetzt werden.

---

## 19. Architekturprinzip für Zukunftssicherheit

Nicht jede mögliche Zukunftsfunktion wird jetzt als Tabelle oder Runtime gebaut.

Stattdessen gilt:

> **IDs und Beziehungen früh richtig machen. Inhalte und Features später kontrolliert erweitern.**

Besonders wichtig von Anfang an:

- stabile interne IDs;
- `play_space_id` als Spielkontext;
- Projektgraph mit Checkpoints/Links;
- `trace_id` über Verarbeitungsketten;
- Mutation Log + Revisionen;
- harte Trennung von LLM-Semantik und deterministischer Wahrheit;
- Provider-Abstraktion für Speech, Reasoning und Research;
- Social als optionale Erweiterung statt Kernabhängigkeit.

---

## 20. Der aktuelle End-to-End-Zielablauf

```text
Nutzer spricht oder schreibt
        |
        v
Speech-to-Text (nur bei Audio)
        |
        v
Reasoning LLM
- Intent
- Kontext
- Entities
- ggf. Rückfrage
        |
        v
Entity Resolver / Schema Validation
        |
        +-----------------------------+
        |                             |
        v                             v
Mutation-/Project Action         Planner / Question
        |                             |
Business Rules                  Breeder / Data Core
Keeper-/Warnschutz              Inventory / Projects
        |                             |
        v                             v
serverseitige Persistenz        valide Optionen
Mutation Log                         |
Revision                              v
        |                         Reasoning LLM
        +---------------+-------------+
                        |
                        v
                 Antwort in PWA
                        |
                  optional Feedback
                  / Improvement Signal
```

---

## 21. Nicht Teil dieses Dokument-PRs

Dieser PR dokumentiert Architektur und Fahrplan.

Er führt ausdrücklich **nicht** aus:

- neue PWA-Runtime;
- D1-Migrationen;
- Cloudflare-Access-Policies;
- API-/MCP-Erweiterungen;
- LLM-/Speech-Secrets;
- Deployments;
- Änderungen an kanonischen Breeding-Daten;
- Social-Runtime;
- persönliche Bestände.

Die konkrete Implementierung startet erst nach einem getrennten Implementierungsauftrag und den in der Roadmap definierten Gates.
