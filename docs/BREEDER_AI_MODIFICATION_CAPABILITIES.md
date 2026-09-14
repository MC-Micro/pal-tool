# Breeder AI PWA – Pal Modification Capabilities

**Stand:** 14. September 2026  
**Status:** spezialisierte Zielarchitektur; noch nicht implementiert oder deployt

## 1. Zweck

Dieses Dokument beschreibt, wie der Breeder AI Planner spätere Ingame-Pal-Modifikationsoptionen und dazugehörige Module berücksichtigen soll, wenn sie einen Breeding-Plan direkt vereinfachen oder sinnvoll abschließen können.

Die im Spiel vorhandene Modifikationsstation wird in der Nutzeroberfläche weiterhin mit ihrem aktuellen deutschen Ingame-Namen dargestellt. Dieses Architekturpapier verwendet neutral den Begriff `Pal Modification`, weil die technische Planner-Domain nicht an eine einzelne UI-Bezeichnung gekoppelt werden soll.

Es enthält bewusst keine unvalidierte aktuelle Modulliste und keine aus Erinnerung übernommenen Werte.

## 2. Grundsatz

Der Planner soll nicht davon ausgehen, dass jede gewünschte Passive zwingend vollständig über Breeding vererbt werden muss.

Wenn der aktuelle Build eine validierte Modifikationsoption erlaubt, kann der Planner vergleichen:

```text
Pure Breeding
vs.
Hybrid Breeding + Pal Modification
vs.
Modification-heavy Finish
```

Die Empfehlung hängt von Spielregel, Bestand, Ressourcenart und Nutzerpräferenz ab.

## 3. Harte Grenze

Das Reasoning-Modell darf keine Modifikationsmöglichkeit erfinden.

Es darf nur mit Capabilities arbeiten, die aus einer kanonischen, buildbezogenen Registry stammen.

Partnerfähigkeiten, echte Passiven und Modifikationsmöglichkeiten bleiben getrennte Domains.

## 4. Capability Registry

Konzeptionell:

```text
pal_modification_capability
- capability_id
- operation_type
- target_rule
- required_resource_id
- resource_mode
  - reusable
  - consumable
  - currency_or_service
  - other_validated_mode
- cost{}
- restrictions{}
- source_build
- provenance
```

Die tatsächlichen Operationstypen werden erst nach Audit des aktuellen Palworld-Builds freigegeben.

## 5. Kernanwendungsfall: fast fertige Passivkombination

Beispiel:

```text
Ziel-Pal benötigt A / B / C / D

Route A:
A / B / C / D vollständig breeden

Route B:
A / B / C breeden
D später über eine validierte Pal-Modification-Capability ergänzen oder ersetzen
```

Route B darf nur angeboten werden, wenn:

1. die Operation fachlich validiert ist;
2. die Zielpassive auf diesem Weg zulässig ist;
3. die benötigte Ressource im persönlichen Play Space vorhanden oder bewusst beschaffbar ist;
4. bekannt ist, ob sie wiederverwendbar oder verbrauchbar ist;
5. die Nutzerpräferenz den Einsatz erlaubt;
6. keine Keeper-, Projekt- oder Ressourcenschutzregel verletzt wird.

## 6. Persönlicher Ressourcenstate

Modifikationsmodule und vergleichbare Ressourcen gehören zum persönlichen Spielzustand des jeweiligen Play Space.

```text
pal_modification_inventory
- user_id
- play_space_id
- reusable_capabilities[]
- consumable_resources{}
- optional_validated_currencies{}
- revision
- updated_at
```

Damit kann dieselbe Person auf verschiedenen Servern unterschiedliche verfügbare Optionen besitzen.

## 7. Wiederverwendbar vs. verbrauchbar

Wiederverwendbare Capability:

```text
resource_id
unlocked = true
```

Verbrauchbare Ressource:

```text
resource_id
count = N
```

Ein verbrauchbares Modul darf niemals wie eine permanente Freischaltung behandelt werden.

## 8. Resource Protection Policy

Knappe Einweg-Ressourcen benötigen eine eigene Schutzlogik.

```text
resource_usage_preference
- resource_id or resource_class
- policy
  - allow
  - ask
  - avoid
  - never
- optional project_id
- optional pal_instance_id
- updated_at
```

Bedeutung:

- `allow`: normal berücksichtigen;
- `ask`: vor geplanter Verwendung explizit nachfragen;
- `avoid`: nur als klar benannte Alternative zeigen;
- `never`: aus automatischer Routenoptimierung ausschließen.

## 9. Warnung vor Verbrauch

Vor einer tatsächlichen Mutation mit einer verbrauchbaren Ressource muss die PWA mindestens zeigen:

- dass die Ressource verbraucht wird;
- welche Ressource betroffen ist;
- bekannte vorhandene Menge;
- bekannte verbleibende Menge;
- ob eine Breeding-Alternative existiert;
- ob eine Nutzerpolicy den Einsatz einschränkt.

Eine knappe Ressource darf niemals still allein aufgrund einer LLM-Empfehlung als verbraucht markiert werden.

## 10. Reasoning-Aufgabe

Das Reasoning-Modell darf freie Präferenzen verstehen und als strukturierte Policy vorschlagen.

Beispiele:

```text
"Für diesen Pal ist mir dieses Modul zu wertvoll."
→ pal- oder projektbezogene Policy = avoid
```

```text
"Einweg-Module in diesem Projekt nie verwenden."
→ project policy = never
```

```text
"Wenn die Alternative sehr viele zusätzliche Zuchtschritte braucht, frag mich."
→ conditional preference / ask
```

Die Speicherung erfolgt erst über die normale schema-validierte Mutation Pipeline.

## 11. Code schützt die Wahrheit

Das LLM entscheidet nicht:

- ob eine Operation im aktuellen Build erlaubt ist;
- ob eine Ressource wiederverwendbar ist;
- wie viele Exemplare vorhanden sind;
- ob eine Keeper-Regel ignoriert werden darf;
- ob eine knappe Ressource ohne Bestätigung verbraucht werden darf.

Diese Informationen kommen aus Data Core, persönlichem Resource State und Business Rules.

## 12. Mehrstufige Passivplanung

Langfristig kann der Planner Zielpassiven so einordnen:

```text
- muss über Breeding erreicht werden
- kann über Breeding erreicht werden
- kann optional über eine validierte Pal-Modification-Capability erreicht werden
- Modifikationsweg aktuell nicht verfügbar
- Modifikationsweg unbekannt
```

`Unbekannt` bleibt unbekannt und wird weder als möglich noch als unmöglich ausgegeben.

## 13. Gesamtaufwand statt Generationenzahl

Eine gute Route minimiert nicht nur Breeding-Stufen.

Spätere Bewertung kann berücksichtigen:

- Breeding-Stufen;
- fehlende Eltern;
- benötigte Geschlechter;
- gewünschte/unerwünschte Passiven;
- IV-/Talentträger;
- Zwischenprodukte;
- Keeper-Schutz;
- Kondensation/Erweckung;
- wiederverwendbare Modifikations-Capabilities;
- benötigte Consumables;
- persönliche Resource Policies;
- bestätigte Beschaffbarkeit, falls vorhanden.

## 14. Beispielworkflow

```text
Ist-Zustand:
- Zielart vorhanden
- gute IVs
- drei Zielpassiven vorhanden
- vierte fehlt

Planner:
1. reine Weiterzucht berechnen
2. Capability Registry für fehlende Passive prüfen
3. persönlichen Ressourcenstate prüfen
4. reusable/consumable unterscheiden
5. Resource Policy prüfen
6. Reasoning-Modell erklärt Trade-off
```

Der Nutzer entscheidet über knappe Ressourcen.

## 15. Weitere Modifikationsfunktionen

Falls der aktuelle Build weitere plannerrelevante Modifikationsoperationen besitzt, können sie später über dieselbe Registry ergänzt werden.

Sie werden nicht vorab aus Erinnerung hardcodiert.

Ein späterer Data-Core-Auftrag soll die vollständige aktuelle Liste, Zielregeln, Kosten und Verbrauchsarten inventarisieren.

## 16. Acquisition als spätere Zusatzdomain

Falls Erwerbswege später für die Routenbewertung benötigt werden:

```text
acquisition
- source_type
- required_currency_or_token
- cost
- availability_conditions
- source_build
- provenance
```

V1 benötigt dafür noch keinen vollständigen Acquisition-Score. Vorhanden/nicht vorhanden sowie Menge reichen zunächst.

## 17. Feedback- und Improvement-Signale

Mögliche Signale:

```text
MODIFICATION_CAPABILITY_UNKNOWN
MODIFICATION_RESOURCE_STATE_MISSING
RESOURCE_POLICY_CONFLICT
HYBRID_ROUTE_NOT_SUPPORTED
CONSUMABLE_WARNING_REQUIRED
```

Wiederkehrende Signale können später native Planner-Zwischenschritte begründen.

## 18. Tests

Vor produktiver Nutzung mindestens:

- wiederverwendbar vs. verbrauchbar korrekt getrennt;
- unbekannte Ressource nicht als verfügbar annehmen;
- `never` blockiert Verwendung;
- `ask` erzwingt Bestätigung;
- Verbrauch mutiert nur den authentifizierten `user_id` + `play_space_id` Zustand;
- Revisionen verhindern stilles Überschreiben;
- reine Breeding-Alternative bleibt berechenbar;
- LLM kann harte Capability-Regeln nicht umgehen;
- Keeper-/Projekt-Schutz bleibt aktiv.

## 19. Data-Core-Audit

Ein späterer technischer Auftrag soll zuerst prüfen:

1. welche Modifikationsdefinitionen im aktuellen Build extrahierbar sind;
2. welche Ressourcenarten existieren;
3. welche wiederverwendbar bzw. verbrauchbar sind;
4. welche Zielregeln gelten;
5. welche weiteren plannerrelevanten Operationen existieren;
6. wie Kosten und Erwerbswege technisch repräsentiert sind;
7. welche Provenienzfelder erforderlich sind.

Erst danach wird eine kanonische Registry erstellt.

## 20. Phasen

### M0 – Audit

Nur Daten-/Schemaanalyse.

### M1 – Registry

Kanonische Capability Registry mit Tests.

### M2 – persönlicher Ressourcenstate

`user_id` + `play_space_id`, reusable/consumable, Revision und Mutation Log.

### M3 – Hybrid Planner

Pure Breeding gegen Breeding+Modification vergleichen.

### M4 – Acquisition / weitere Operationen

Nur bei echtem Planner-Nutzen und belastbaren Daten.

## 21. Stopppunkte

Review ist erforderlich, wenn:

- eine Wirkung nicht belastbar belegt ist;
- der Buildbezug unklar ist;
- reusable/consumable nicht eindeutig bestimmbar ist;
- eine knappe Ressource ohne Schutzlogik verbraucht werden könnte;
- eine Operation nur über Pal-spezifische Hardcodes abbildbar wäre;
- der Scope in Richtung allgemeines Ressourcenmanagement statt Breeding-Planung abdriftet.

## 22. Aktueller Konsens

- validierte Pal-Modifikation darf Breeding-Routen ergänzen;
- reine Breeding-Routen bleiben immer berechenbar;
- Hybridrouten dürfen einen gezielten Finish berücksichtigen;
- wiederverwendbare und verbrauchbare Ressourcen bleiben getrennt;
- knappe Consumables bekommen harte Warn- und Policy-Regeln;
- Nutzer können Ressourcen projekt- oder palspezifisch schützen;
- Reasoning versteht Präferenzen und erklärt Trade-offs;
- Code schützt Spielwahrheit und Ressourcen;
- persönlicher Ressourcenstate ist an `user_id` + `play_space_id` gebunden;
- konkrete aktuelle Modulnamen, Werte und Kosten werden erst nach Data-Core-/Build-Validierung kanonisch;
- Breeder AI bleibt fokussiert und wird nicht zum allgemeinen Palworld-Ressourcenmanager.