# Breeder AI PWA – Multi-User Planner Architecture

**Stand:** 14. September 2026  
**Status:** verbindliches Zielbild / Konzeptphase; noch nicht implementiert oder deployt

## 1. Ziel

Die Breeder AI PWA soll den bestehenden deterministischen, read-only Palworld-Breeder um eine private, sprachfähige und bestandsoptimierte Planner-Oberfläche für eine kleine Gruppe von Nutzern erweitern.

Das Produktziel ist eine auf Handy, Tablet, Laptop und PC nutzbare PWA, die sich wie ein einfacher KI-Chat bedienen lässt:

- Text oder Sprache als Eingabe;
- natürliche deutsche und englische Formulierungen;
- serverseitig gespeicherter persönlicher Bestand pro Nutzer;
- sichere automatische oder bestätigte Bestandsänderungen;
- bestandsoptimierte Zuchtrouten;
- Passiv-, Geschlechts-, IV-/Talent-, Varianten- und Zwischenproduktplanung;
- Kondensations-/Sterneplanung einschließlich vorhandener Materialkopien;
- geräteübergreifende Wiederherstellung nach Neuinstallation, Gerätewechsel oder Sessionverlust.

Der bestehende öffentliche Breeder bleibt die fachliche Wahrheit für Zuchtarten und Paarungen. Ein LLM darf Zuchtbeziehungen niemals erfinden oder als eigene Wahrheit führen.

## 2. Nicht-Ziele und harte Grenzen

Für die erste Ausbaustufe gelten folgende Grenzen:

- keine Änderung der kanonischen Zuchtregeln durch die PWA;
- kein schreibender Zugriff auf den öffentlichen Breeder-MCP;
- kein direkter Zugriff der Benutzer auf MCP-Konfiguration, Worker-Secrets oder API-Schlüssel;
- keine Speicherung persönlicher Bestände im öffentlichen Git-Repository;
- keine Pflicht, einen vollständigen Palbox-Bestand vorab zu pflegen;
- keine eigene Passwortdatenbank und kein eigener Passwort-Reset-Dienst;
- keine Behauptung über Fangbarkeit, Beschaffungsaufwand oder Kondensationskosten, solange diese Daten nicht aktuell validiert sind;
- keine automatisch ausgeführten destruktiven Änderungen bei unsicherer Sprach- oder Entity-Erkennung.

## 3. Geplante Gesamtarchitektur

```text
PWA auf Handy / Tablet / Laptop / PC
        │
        ├── Text
        └── Mikrofonaufnahme
                 │
                 ▼
       Speech-to-Text Provider
                 │
                 ▼
        LLM Intent Extraction
  "Was möchte der Nutzer tun?"
                 │
                 ▼
       Palworld Entity Resolver
  "Welche echten Entities sind gemeint?"
                 │
        ┌────────┴─────────┐
        │                  │
        ▼                  ▼
 Inventory Mutation     Planner Request
        │                  │
        ▼                  ├── persönlicher Bestand
 Auth + Mutation Gate      ├── Breeder read-only
        │                  ├── Data Core
        ▼                  └── validierte Zusatzdaten
 Cloudflare D1               │
        │                     ▼
        └─────────────── Planner Engine
                              │
                              ▼
                       LLM Erklärung / Auswahl
                              │
                              ▼
                         Antwort in der PWA
```

Die Schichten bleiben absichtlich getrennt. Das LLM interpretiert und erklärt; der Resolver validiert; die Mutation Engine schreibt; der Breeder liefert Zuchtwahrheit; der Planner vergleicht reale Kandidaten.

## 4. Breeder-Grenze: ausschließlich read-only

Der bestehende öffentliche MCP bleibt unverändert zustandslos und read-only mit genau den dokumentierten fünf Tools:

- `breeding_status`
- `breeding_pair`
- `breeding_parents`
- `breeding_children`
- `breeding_route`

Die PWA-Benutzer erhalten keinen direkten MCP-Zugang. Der Planner beziehungsweise das Backend ruft nur die erlaubten read-only Tools auf.

Es darf im Modell-Toolset keine Funktion geben, mit der kanonische Zuchtdaten, Worker-Konfiguration, Deployments, Tokens oder Repositorydateien verändert werden können.

## 5. Identität, Login und Gerätewechsel

### 5.1 Grundprinzip

Die Nutzeridentität ist serverseitig und niemals an ein einzelnes Gerät gebunden.

Empfohlener Startweg für die private Friends-&-Family-Nutzung:

1. Cloudflare Access schützt die PWA beziehungsweise den identity-aware API-Pfad.
2. Zulässige E-Mail-Adressen stehen auf einer Allowlist.
3. Anmeldung erfolgt zunächst per E-Mail-One-Time-PIN statt eigenem Passwort.
4. Beim ersten erfolgreichen Login wird eine interne, stabile UUID erzeugt.
5. Alle Bestandsdaten hängen ausschließlich an dieser internen UUID.
6. Eine vom Client oder LLM mitgesendete `user_id` wird niemals als Autorität akzeptiert.

Beispiel:

```text
Cloudflare-Identität: user@example.com
           │
           ▼
auth_identity
           │
           ▼
interne user_id: 8f72-...-....
           │
           ▼
Inventory / Projekte / Mutation Log
```

Ein neues Handy, Tablet oder ein neu installierter Browser erzeugt damit keinen neuen Bestand. Nach erneuter Anmeldung mit derselben verknüpften Identität wird dieselbe interne `user_id` geladen.

### 5.2 Recovery

Wenn eine E-Mail-Adresse dauerhaft verloren geht, soll eine separate Adminfunktion eine neue Auth-Identität mit derselben internen `user_id` verknüpfen können.

Diese Adminfunktion:

- ist nicht Teil des normalen KI-Toolsets;
- ist nicht per Nutzerprompt aufrufbar;
- darf keinen neuen Bestand erzeugen, wenn eigentlich eine bestehende Identität wiederhergestellt werden soll;
- protokolliert Identity-Rebinds.

### 5.3 Cloudflare-Access-Implementierungsfallstrick

Zum Konzeptstand 14.09.2026 gilt: Worker Static Assets laufen über einen internen Router, der `ctx.access` nicht an den User Worker weitergibt. Daher darf die Implementierung nicht voraussetzen, dass ein kombinierter Static-Assets-Worker automatisch die Access-Identität im API-Code sieht.

Vor Implementierung ist ein Phase-0-Spike erforderlich. Zulässige Lösungsrichtungen:

- Asset- und identity-aware API-Pfad technisch trennen;
- die PWA ohne den problematischen Static-Assets-Router ausliefern;
- oder einen dokumentierten, validierten Access-Token/JWT-Weg für die API-Identität verwenden.

Die konkrete Variante wird erst nach einem kleinen End-to-End-Test festgelegt.

## 6. Multi-User-Isolation

### 6.1 Ziel

Fünf oder mehr Nutzer sollen dieselbe Anwendung verwenden können, ohne fremde Bestände lesen oder verändern zu können.

### 6.2 Empfohlene V1-Struktur

Für die kleine Gruppe wird zunächst eine D1-Datenbank mit harter logischer Mandantentrennung empfohlen.

Jede Inventory-Operation erhält die interne `user_id` ausschließlich aus dem serverseitig validierten Auth-Kontext.

Es existiert keine öffentliche API wie:

```text
POST /inventory?user_id=<frei wählbar>
```

sondern sinngemäß:

```text
POST /api/inventory/mutations
Auth-Kontext → serverseitige user_id → genau dieser Bestand
```

### 6.3 Sicherheitsregeln

- kein generischer Clientparameter darf die Ziel-`user_id` bestimmen;
- alle Data-Access-Funktionen verlangen einen authentifizierten User-Kontext;
- normale Nutzerendpunkte dürfen keine `list all users`-Funktion besitzen;
- Adminpfade sind logisch und auth-seitig getrennt;
- jede Mutation erhält eine `user_id`, Revision und Idempotency-ID serverseitig;
- Cross-Tenant-Tests sind Pflicht vor Deployment;
- ein Prompt wie "ändere den Bestand von Nutzer X" darf technisch keinen anderen Nutzer erreichen.

Für V1 ist eine einzige D1-Datenbank leichter zu warten als eine Datenbank pro Person. Falls später stärkere physische Isolation erforderlich wird, kann eine separate Persistenzgrenze pro Nutzer neu bewertet werden.

## 7. Empfohlenes V1-Datenmodell

Für die kleine Nutzergruppe wird kein unnötig komplexes Palbox-ERP benötigt. Empfohlen wird ein leichtgewichtiges Modell aus stabilen Nutzerkonten, einem versionierten Inventory-State und einem unveränderbaren Änderungsprotokoll.

### 7.1 Nutzer

```text
users
- user_id (UUID, intern, stabil)
- display_name
- locale (de/en)
- status
- created_at
- updated_at
```

### 7.2 Auth-Identitäten

```text
auth_identities
- identity_id
- user_id
- provider
- provider_subject
- normalized_email
- active
- created_at
```

Eine interne `user_id` kann später mehr als eine gültige Login-Identität besitzen.

### 7.3 Persönlicher Inventory-State

V1 kann den eigentlichen Bestand als ein versioniertes JSON-Dokument pro Nutzer speichern. Das hält die Schreibfläche klein und reduziert das Risiko, bei vielen Tabellen versehentlich einen Tenant-Filter zu vergessen.

```text
inventory_state
- user_id (Primary Key)
- schema_version
- revision
- state_json
- updated_at
```

Bei wachsendem Funktionsumfang kann später kontrolliert auf stärker normalisierte Tabellen migriert werden.

### 7.4 Wertvolle konkrete Pals

Ein konkretes Pal-Exemplar kann mindestens enthalten:

```text
pal_instance
- instance_id
- species_internal_id
- gender: male | female | unknown
- passives[]
- ivs/talents: optional / unknown erlaubt
- variant flags: z. B. Lucky, Alpha, weitere validierte Formen
- condensation_stars: 0..4
- keeper: boolean
- tags[]
- note: optional
- created_at
- updated_at
```

`keeper=true` bedeutet: Dieses konkrete Pal darf von automatischen Material- oder Optimierungsvorschlägen nicht als zu verbrauchendes Exemplar eingeplant werden.

### 7.5 Material-/Duplikatpool

Nicht jedes wertlose Duplikat muss als Einzelinstanz gespeichert werden. Für reine Kondensationskopien reicht ein Art-Pool.

```text
material_pool
- species_internal_id
- raw_copy_count
- weitere validierte Materialeinheiten optional
```

Ein konkretes Pal mit interessanten Passiven, IVs, Variante, Geschlecht oder persönlichem Wert wird als Instanz geführt; reine Duplikate können als Anzahl geführt werden.

Die Umrechnung bereits kondensierter Material-Pals in Materialwert darf nicht geraten werden. Sie gehört in ein patchvalidiertes Kondensationsregelmodul.

### 7.6 Laufende Projekte

Optionaler Projektzustand:

```text
breeding_project
- project_id
- target_species
- desired_passives[]
- unwanted_passives[]
- desired_ivs/talents
- variant requirements
- priority profile
- status
- created_at
- updated_at
```

## 8. Spracheingabe und Transkription

### 8.1 UX

Die PWA soll sich wie ein normaler Messenger bedienen lassen:

- Mikrofon einmal antippen → Aufnahme startet;
- erneut antippen oder "Senden" → Aufnahme endet;
- Text bleibt immer als Alternative verfügbar;
- erkannter Text kann vor einer unsicheren Mutation angezeigt oder korrigiert werden.

Kein Push-to-talk-Zwang.

### 8.2 Provider-Abstraktion

Speech-to-Text wird hinter einem Provider-Adapter gekapselt. Das aktuelle Ziel ist ein Transkriptionsmodell mit Custom-Vocabulary-Unterstützung; konkrete Modellnamen und Free-Tier-Quoten werden bei Implementierung erneut geprüft und nicht als dauerhafte Architekturannahme festgeschrieben.

```text
SpeechProvider.transcribe(audio, contextVocabulary)
```

### 8.3 Dynamisches Custom Vocabulary

Die Transkriptions-API kann zum aktuellen Konzeptstand bis zu 1.000 Custom-Vocabulary-Terme annehmen, wobei der Anbieter für beste Ergebnisse typischerweise deutlich kleinere, relevante Vokabulare empfiehlt.

Daher kein statischer 1.000-Begriffe-Dump. Stattdessen dynamisch priorisieren:

1. Pals und Passiven des aktuellen Projekts;
2. Pals aus dem persönlichen Bestand;
3. Ziel- und Zwischenarten einer aktuellen Route;
4. häufig verwechselte Palworld-Namen;
5. relevante deutsche und englische Aliasse;
6. verbleibender Platz für aktuelle neue Entities.

Der Resolver bleibt trotzdem die verbindliche Validierungsstufe nach der Transkription.

## 9. Freie Sprache → strukturierter Arbeitsauftrag

Das LLM darf freie deutsche oder englische Sprache in einen strikt schema-validierten Entwurf übersetzen.

Beispiel Eingabe:

```text
Ich hab einen weiblichen Elphidran Aqua mit zwei Sternen.
Den will ich behalten. Er hat Passive A, B, C und D.
```

Beispiel Intent-Entwurf:

```json
{
  "intent": "ADD_PAL_INSTANCE",
  "entity_mentions": {
    "species": "Elphidran Aqua",
    "passives": ["A", "B", "C", "D"]
  },
  "attributes": {
    "gender": "female",
    "condensation_stars": 2,
    "keeper": true
  },
  "confidence": "high"
}
```

Dieser Entwurf besitzt noch keine Schreibberechtigung.

## 10. Palworld Entity Resolver

Der Entity Resolver ist eigener deterministischer Code und nicht die freie Vermutung des LLM.

Er normalisiert gegen kanonische Data-Core-/Domain-Daten:

- Pal-Arten;
- deutsche und englische Namen;
- interne IDs;
- bekannte Aliasse;
- Passiven DE/EN;
- Varianten/Formen;
- weitere später freigegebene Entity-Typen.

Ablauf:

1. exakter kanonischer Treffer;
2. exakter Alias-/Lokalisierungstreffer;
3. normalisierte Schreibweise;
4. Fuzzy-Kandidaten;
5. bei eindeutiger hoher Übereinstimmung normalisieren;
6. bei echter Mehrdeutigkeit stoppen und den Nutzer fragen.

Ein nicht bestätigter Fuzzy-Treffer darf keine destruktive Bestandsänderung auslösen.

## 11. Inventory Mutation Engine

### 11.1 Grundsatz

Das LLM schreibt niemals direkt in D1. Es erzeugt nur einen Mutation-Entwurf.

Der tatsächliche Schreibweg lautet:

```text
LLM Intent
→ Schema-Validierung
→ Entity Resolver
→ Business-Regeln
→ Confirmation Policy
→ Mutation Envelope
→ serverseitige user_id
→ atomischer D1-Write
→ Revision erhöhen
→ Mutation Log
```

### 11.2 Kernkommandos

V1 sollte mindestens folgende interne Kommandos besitzen:

- `ADD_PAL_INSTANCE`
- `UPDATE_PAL_INSTANCE`
- `SOFT_DELETE_PAL_INSTANCE`
- `ADD_MATERIAL_COPIES`
- `SET_MATERIAL_COPIES`
- `REMOVE_MATERIAL_COPIES`
- `MARK_KEEPER`
- `UNMARK_KEEPER`
- `SET_CONDENSATION_STARS`
- `SET_GENDER`
- `SET_PASSIVES`
- `SET_IVS_TALENTS`
- `CREATE_BREEDING_PROJECT`
- `UPDATE_BREEDING_PROJECT`

### 11.3 ADD versus SET ist sicherheitskritisch

Natürliche Sprache kann Mengen semantisch unterscheiden:

- "Ich habe **noch sechs** Omascul gezüchtet" → wahrscheinlich `ADD_MATERIAL_COPIES +6`.
- "Ich habe **insgesamt sechs** Omascul" → `SET_MATERIAL_COPIES 6`.
- "Ich habe sechs Omascul" → ohne Kontext potenziell mehrdeutig; nachfragen statt raten.

Diese Unterscheidung muss im Intent-Schema explizit abgebildet werden.

### 11.4 Schreibatomizität

Ein komplexer Pal-Eintrag wird nicht als Folge unabhängiger unsicherer Writes behandelt.

Beispiel:

```text
Elphidran Aqua anlegen
+ weiblich
+ 2 Sterne
+ keeper
+ vier Passiven
```

wird zuerst vollständig validiert und anschließend als eine atomische Mutation geschrieben. D1-Batch/Transaktionsverhalten ist vor Implementierung mit Integrationstests zu verifizieren.

## 12. Confirmation Policy

Die Anwendung soll angenehm sein, aber keine stillen Datenfehler erzeugen.

Empfohlener Default:

### Direkt speicherbar nach explizitem Nutzer-Opt-in

- eindeutig erkannte rein additive Materialkopien;
- harmlose Notizen/Tags;
- Änderungen mit exaktem Entity-Match und eindeutigem Verb.

### Ein-Tap-Bestätigung

- neues wertvolles Pal-Exemplar;
- neue Passiv-/IV-Kombination;
- Änderung der Sterne;
- Keeper-Status setzen;
- Umwandlung eines Material-Pals in ein konkretes wertvolles Exemplar.

### Immer bestätigen

- Löschen;
- Keeper entfernen;
- Mengen `SET` statt `ADD`;
- widersprüchliche Änderungen;
- Fuzzy-/mehrdeutige Entity-Auflösung;
- Zusammenführen oder Ersetzen bestehender Instanzen.

Später kann jeder Nutzer "sichere Änderungen automatisch speichern" als persönliche Komfortoption aktivieren.

## 13. Änderungshistorie und Undo

Jede bestätigte Mutation erzeugt einen serverseitigen Logeintrag:

```text
mutation_log
- mutation_id
- user_id
- idempotency_key
- inventory_revision_before
- inventory_revision_after
- mutation_type
- normalized_payload
- previous_state / undo payload
- source: text | voice | ui
- created_at
```

Die UI zeigt mindestens die letzte Änderung mit `Rückgängig` / `Undo` an.

D1 Time Travel ist nur Katastrophen-/Datenbank-Recovery und kein normaler Benutzer-Undo-Mechanismus, weil ein globaler Datenbank-Restore auch andere Nutzer betreffen kann.

## 14. Multi-Device, Revisionen und Konflikte

Der Serverzustand ist die einzige autoritative Bestandswahrheit.

Jeder Inventory-State besitzt eine monotone `revision`.

Ein Schreibrequest enthält die zuletzt gelesene Revision. Wenn der Server bereits weiter ist:

- nicht blind überschreiben;
- aktuellen Stand laden;
- nicht kollidierende additive Operationen kontrolliert neu anwenden;
- konfliktträchtige Updates dem Nutzer zur Bestätigung zeigen.

Jede Mutation erhält zusätzlich eine Idempotency-ID, damit ein Netzwerk-Retry nicht versehentlich doppelt `+6` Materialkopien schreibt.

Wenn später D1 Read Replication verwendet wird, muss die Implementierung die Sessions-/Bookmark-Mechanismen für "read your own writes" beziehungsweise sequenzielle Konsistenz berücksichtigen.

## 15. Offline-Strategie

Die PWA soll auf allen Plattformen robust wirken, aber Offline-Schreiben wird bewusst konservativ behandelt.

### Offline erlaubt

- App-Shell öffnen;
- zuletzt synchronisierten Bestand ansehen;
- Entwürfe schreiben;
- optional nicht gesendete Audio-/Textentwürfe lokal halten;
- Hilfetexte und letzte Planner-Ergebnisse lesen.

### Offline nicht als bestätigt markieren

- Bestandsmutation;
- Login-/Identity-Rebind;
- Planner-Berechnung, die aktuelle Server-/Breederdaten benötigt.

Offline erstellte Mutation-Entwürfe werden bei wiederhergestellter Verbindung erneut validiert und erst danach bestätigt oder geschrieben.

Die PWA muss sichtbar zwischen `lokal vorgemerkt` und `serverseitig gespeichert` unterscheiden.

## 16. PWA- und Plattformregeln

Die PWA muss als normale Website vollständig benutzbar bleiben und sich optional installieren lassen.

Pflichtziele:

- responsive Handy-/Tablet-/Desktop-Oberfläche;
- Touch, Maus und Tastatur;
- `display: standalone` als gewünschter Installationsmodus;
- Service Worker für App-Shell und Read-Cache;
- Feature Detection für Mikrofon/MediaRecorder;
- Textinput als vollständiger Fallback;
- verständlicher Installationshinweis je Plattform statt Annahme eines identischen Installationsflows.

Installationen verschiedener Browser sind technisch getrennte lokale Instanzen. Deshalb dürfen wichtige persönliche Daten nie nur im Browser-Storage liegen.

## 17. Planner Engine

### 17.1 Verantwortungsteilung

**Breeder:** Was ist züchterisch möglich?  
**Inventory:** Was besitzt dieser Nutzer konkret?  
**Planner:** Welche validen Routen passen praktisch zum Bestand?  
**LLM:** Welche der berechneten Optionen passt zu den Nutzerprioritäten und wie wird sie verständlich erklärt?

### 17.2 Kandidatengenerierung

V1 darf zunächst mit den bestehenden Breeder-Tools mehrere echte Kandidaten erzeugen und mit Bestandsdaten anreichern.

Langfristig soll eine deterministische inventory-aware Planner Engine systematisch die besten Kandidaten vorselektieren, bevor das LLM sie bewertet.

Mindestens getrennt betrachten:

1. Generationen;
2. bereits vorhandene konkrete Eltern;
3. fehlende Arten;
4. notwendige Geschlechter;
5. gewünschte und unerwünschte Passiven;
6. IVs/Talente;
7. Varianten/Formen;
8. vorhandene Zwischenprodukte;
9. Wiederverwendbarkeit wertvoller Träger;
10. Keeper-Schutz;
11. validierte Beschaffbarkeit, sobald diese Daten im Data Core zuverlässig vorliegen.

Eine Route mit mehr Generationen kann besser sein, wenn dafür wertvolle vorhandene Träger eingesetzt und weniger neue Pals beschafft werden müssen.

### 17.3 Keine erfundene Beschaffbarkeit

Solange der Data Core keine validierten Fang-, Ei-, Händler- oder sonstigen Beschaffungsdaten für eine Art liefert, darf der Planner nicht als Fakt behaupten, ein fehlendes Pal sei "einfacher" oder "schwieriger" zu bekommen.

Bis dahin darf Beschaffbarkeit nur aus:

- expliziten Nutzerangaben;
- validierten Data-Core-Daten;
- oder bewusst getrennten, aktuellen Rechercheergebnissen

abgeleitet werden.

## 18. Kondensations-/Sterneplaner

Sterne/Kondensationsstufe werden Teil jedes konkreten wertvollen Pal-Exemplars.

Der Planner soll Fragen beantworten können wie:

```text
"Mein Lucky Omascul ist 2 Sterne und soll 4 Sterne werden.
Ich habe noch drei normale Kopien. Was fehlt?"
```

Regeln:

- das Ziel-/Keeper-Pal wird niemals selbst als Material eingeplant;
- vorhandene Materialkopien werden abgezogen;
- bereits kondensierte Spender werden nur nach aktuell validierter Spielregel in Materialeinheiten umgerechnet;
- benötigte Kopien werden aus einem patchvalidierten Kondensationsregelmodul berechnet und nicht als unveränderliche Zahl im Prompt festgeschrieben;
- Planner-Ausgabe trennt vorhandene, fehlende und zu erzeugende/fangende Materialmenge.

## 19. Mehrsprachigkeit DE/EN

Deutsch und Englisch sind von Anfang an Kernanforderung.

Die Spracherkennung darf die Sprache erkennen; die Entity-Auflösung bleibt sprachunabhängig über interne IDs.

Beispiel:

```text
DE Passive ─┐
EN Passive ─┼─> passive_internal_id
Alias      ─┘
```

Ein Nutzer kann auf Deutsch sprechen, ein anderer auf Englisch; beide erzeugen denselben kanonischen Zustand.

Die UI-Lokalisierung ist getrennt vom Datenmodell. Freitextnotizen bleiben in der vom Nutzer verwendeten Sprache.

## 20. LLM-/Provider-Abstraktion

Die PWA darf nicht technisch an genau ein KI-Modell gekoppelt werden.

Geplante Interfaces:

```text
SpeechProvider
ReasoningProvider
EntityResolver
BreederClient
InventoryStore
PlannerEngine
```

Der erste Provider kann aus Kostengründen ein aktuelles Free-Tier-Angebot verwenden. Modellname, Preis, Rate-Limit und Free-Tier-Verfügbarkeit sind aber Runtime-/Deploymententscheidungen und müssen vor Implementierung beziehungsweise Providerwechsel aktuell geprüft werden.

Dadurch kann später beispielsweise nur der ReasoningProvider gewechselt werden, ohne Inventory, Resolver oder Breeder umzubauen.

## 21. Sicherheit gegen LLM-Fehler und Prompt Injection

Der Nutzer darf frei formulieren. Daraus folgt ausdrücklich nicht, dass das Modell freie Schreibrechte erhält.

Harte Regeln:

- LLM-Ausgaben müssen gegen JSON-Schema beziehungsweise typisierte Commands validiert werden;
- unbekannte Commandtypen werden verworfen;
- `user_id`, Rollen, Auth-Status und Adminrechte kommen nie aus dem LLM;
- Entity-IDs kommen aus dem Resolver, nicht aus freiem Modelltext;
- Breeder-Tools bleiben read-only;
- Secrets existieren nur serverseitig;
- das Frontend erhält keine Provider-API-Keys;
- Adminfunktionen werden nicht als Modelltools angeboten;
- mutierende Requests sind rate-limited und auditierbar;
- Audio wird standardmäßig nicht dauerhaft gespeichert.

## 22. Chat- und Datenschutz-Minimierung

Auch bei privater Friends-&-Family-Nutzung wird nur gespeichert, was für das Produkt benötigt wird.

Empfohlener Default:

- kein dauerhaftes Speichern der Roh-Audioaufnahme;
- kein vollständiges Chatprotokoll als technische Voraussetzung;
- dauerhaft speichern: normalisierter Bestand, Projekte, Einstellungen und Mutation Log;
- optional kurze sichtbare Gesprächshistorie als separates Komfortfeature, falls bewusst aktiviert;
- keine Secrets, Passwörter oder persönlichen Chatprotokolle im Git-Repository.

## 23. Fehler- und Degradationsverhalten

Wenn ein Provider ausfällt oder sein Free Tier ausgeschöpft ist:

- Textinput und manuelle Inventory-UI bleiben nutzbar;
- gespeicherter Bestand bleibt zugänglich;
- keine Mutation wird wegen eines Provider-Retry doppelt geschrieben;
- ein alternativer Provider kann über Adapter später aktiviert werden;
- unbekannter Providerstatus wird als unbekannt gemeldet, nicht als Datenfehler des Breeders.

## 24. Observability ohne private Inhalte

Serverlogs sollen technische Ereignisse erfassen, aber keine unnötigen Inhalte:

- Request-/Mutation-ID;
- pseudonyme interne user_id;
- Commandtyp;
- Ergebnisstatus;
- Latenz;
- Provider-/Breeder-Fehlerklasse;
- keine Roh-Audioinhalte;
- keine API-Schlüssel;
- keine vollständigen privaten Prompts, sofern nicht ausdrücklich für einen temporären Debugmodus aktiviert.

## 25. Pflicht-Tests vor dem ersten echten Nutzer

### Auth und Isolation

- User A kann User B weder lesen noch verändern;
- manipulierte `user_id` im Request wird ignoriert/verworfen;
- unauthentifizierte Mutation wird abgelehnt;
- Login auf neuem Gerät lädt denselben Bestand;
- Identity-Rebind behält dieselbe interne user_id.

### Sprache und Resolver

- DE/EN Pal-Namen;
- DE/EN Passiven;
- absichtlich falsch transkribierte Pal-Namen;
- mehrere plausible Kandidaten → Nachfragen;
- gemischte deutsche/englische Sätze;
- unbekannte Entities werden nicht erfunden.

### Mutationen

- ADD versus SET;
- Retry mit gleicher Idempotency-ID;
- atomisches Erstellen eines Pal-Exemplars;
- Keeper-Schutz;
- Undo;
- zwei Geräte mit konkurrierenden Revisionen.

### Planner

- öffentliche Breederdaten bleiben unverändert;
- theoretisch kürzere und bestandsoptimierte Route werden getrennt bewertet;
- fehlende Geschlechter werden als Engpass erkannt;
- Passiven/IVs werden nicht erfunden;
- nicht validierte Beschaffbarkeit wird nicht als Fakt behauptet.

### PWA

- Android Chrome/Samsung Internet;
- iOS/iPadOS Safari beziehungsweise unterstützter Installationsweg;
- Desktop Chromium;
- Browsermodus ohne Installation;
- Mikrofon verweigert → Textfallback;
- Offlinezustand verständlich sichtbar.

## 26. Projektfahrplan

### Phase 0 – Architektur- und Auth-Spike

- diesen Architekturstand reviewen;
- Cloudflare-Access-/Static-Assets-Identitätsweg praktisch verifizieren;
- minimalen D1-Schema-Prototyp festlegen;
- keine Produktion und keine echten Bestände.

**Exit:** Login auf zwei Geräten ergibt dieselbe interne user_id; User-Isolation ist im Test nachgewiesen.

### Phase 1 – Private PWA + Text-Inventory

- Chat-artiges PWA-Grundgerüst;
- Access-Login;
- D1-Inventory-State + Revision;
- manuelle UI und Texteingabe;
- Mutation Log + Undo;
- noch keine Sprache nötig.

**Exit:** Zwei Testnutzer können ihre eigenen Bestände geräteübergreifend pflegen, ohne Cross-Tenant-Leak.

### Phase 2 – Entity Resolver DE/EN

- Pal- und Passivindex aus Data Core/Domain;
- Aliasse und Fuzzy-Kandidaten;
- Ambiguitätsdialog;
- streng typisierte Mutation Commands.

**Exit:** absichtliche Schreibfehler erzeugen entweder den richtigen eindeutigen kanonischen Treffer oder eine Rückfrage, niemals eine erfundene Entity.

### Phase 3 – Sprache

- Mikrofonaufnahme;
- SpeechProvider;
- dynamisches Custom Vocabulary;
- Transkript → Intent → Resolver → Mutation Preview.

**Exit:** typische deutsche und englische Palworld-Sätze lassen sich auf Handy und Desktop zuverlässig erfassen.

### Phase 4 – Inventory-aware Breeding Planner

- BreederClient ausschließlich read-only;
- mehrere reale Kandidatenrouten;
- Inventory-Anreicherung;
- deterministische Vorbewertung;
- LLM-Erklärung/Empfehlung.

**Exit:** eine längere, aber praktisch bessere Bestandsroute kann begründet einer rein kürzeren Artenroute vorgezogen werden.

### Phase 5 – Kondensationsplanner

- patchvalidiertes Kondensationsregelmodul;
- Sterne, Keeper und Materialpool;
- fehlende Materialeinheiten berechnen;
- konkrete Ziel-Pals schützen.

### Phase 6 – Polishing

- Nutzereinstellungen;
- optionale sichere Auto-Saves;
- Installationshilfe je Plattform;
- optionale Export-/Import-Sicherung;
- Provider-Fallback;
- weitere Data-Core-Entities nur nach Bedarf.

## 27. Offene Produktentscheidungen

Diese Punkte sind noch nicht endgültig festgelegt und sollen bewusst mit dem Produktnutzer entschieden werden:

1. **Bestätigungsmodus:** standardmäßig jedes neue wertvolle Pal bestätigen oder sichere `ADD_PAL_INSTANCE`-Fälle direkt speichern?
2. **Materialannahme:** mehrere Pals ohne Eigenschaften niemals automatisch als Kondensationsmaterial behandeln oder optional eine schnelle Material-Eingabe anbieten?
3. **Chat-Historie:** gar nicht, begrenzt oder dauerhaft serverseitig speichern?
4. **Keeper-Wortschatz:** `Keeper` als UI-Begriff plus Synonyme wie `behalten`, `nicht verwenden`, `main`, `don't use as material`?
5. **Admin-Recovery:** einfache manuelle Identity-Neuverknüpfung oder später kleine separate Admin-UI?
6. **Bestands-Export:** bereits in V1 ein persönliches JSON-Backup anbieten oder erst nach stabilem Schema?
7. **Gruppenfunktionen:** streng private Inventare als dauerhafte Grenze oder später bewusst freigegebene einzelne Pals zwischen Gruppenmitgliedern teilbar machen?
8. **Beschaffbarkeit:** soll der Data Core später explizite Fang-/Ei-/Händler-/Spawnquellen für Planner-Rankings bekommen?

## 28. Aktuelle Empfehlung

Für die erste reale Friends-&-Family-Version:

- eine kleine, private PWA;
- Cloudflare Access mit E-Mail-OTP und Allowlist;
- stabile interne UUID pro Nutzer;
- eine D1-Datenbank mit harter serverseitiger user_id-Isolation;
- serverseitiger Inventory-State als Wahrheit;
- lokaler Browser nur als Cache/Entwurfsfläche;
- kein dauerhafter Audio-Upload;
- Entity Resolver DE/EN;
- LLM nur für Intent/Planung/Erklärung;
- Breeder unverändert read-only;
- Confirmation Gate vor riskanten Writes;
- Mutation Log + Undo;
- Provider-Abstraktion statt Modell-Lock-in.

## 29. Deploymentfolgen dieses Dokuments

Keine.

Dieses Dokument beschreibt nur die Zielarchitektur. Es erzeugt keine neue Runtime, Datenbank, Access-Policy, Worker-Route, API, MCP-Funktion oder Deploymentkonfiguration. Jede spätere Implementierung benötigt einen separaten freigegebenen technischen Diff mit Tests und Deploymentprüfung.
