# Breeder AI PWA – Species & Mobility Capabilities

**Stand:** 14. September 2026  
**Status:** spezialisierte Zielarchitektur; noch nicht implementiert oder deployt

## 1. Zweck

Dieses Dokument erweitert den Breeder-AI-Blueprint um artbezogene Daten, die direkte Planner-Entscheidungen verbessern können, ohne das Produkt zu einem vollständigen Combat- oder Build-Simulator auszubauen.

Lesereihenfolge:

1. `BREEDER_AI_CURRENT_BLUEPRINT.md`
2. `BREEDER_AI_IMPLEMENTATION_ROADMAP.md`
3. dieses Dokument
4. die übrigen PWA-/Planner-/Social-Detaildokumente

Konkrete Palwerte oder Sonderregeln werden hier nicht als Spielwahrheit festgeschrieben. Sie müssen später aus einer belastbaren aktuellen Quelle extrahiert und validiert werden.

## 2. Produktgrenze

Direkt im Planner-Scope liegen Daten, die mindestens eine dieser Fragen beeinflussen:

- Welche Art ist als Zuchtziel grundsätzlich geeignet?
- Welches Element passt zum Ziel?
- Welche Art besitzt interessante Base-Stats?
- Welches Mount ist anhand belastbarer Mobility-Daten sinnvoll?
- Welche vorhandenen Pals verkürzen die Route zu einem geeigneten Ziel?

Bewusst außerhalb dieses Scopes bleiben zunächst:

- vollständige Damage-/DPS-Simulation;
- levelabhängige Endstats;
- Accessoire-Simulation;
- Zutraulichkeits-/Freundschafts-Skalierung;
- vollständige Skillrotation;
- Spielerbuffs und vollständiges Schadensmodell;
- subjektives Handling als scheinbar objektiver Score.

Grundsatz:

> Der Data Core darf mehr wissen, als Breeder AI aktuell benutzt. Der Planner konsumiert nur Domains mit klarem Breeding-/Zielwahl-Nutzen.

## 3. Species Capability Summary

Langfristig soll der Data Core eine erweiterbare artbezogene Sicht bereitstellen können.

Konzeptionell:

```text
species_capability_summary
- species_internal_id
- elements[]
- base_stats{}
- mobility{}
- partner_skill_id
- capability_flags[]
- source_build
- provenance
- schema_version
```

Species-Daten werden nicht in jede persönliche `pal_instance` kopiert. Die persönliche Instanz referenziert nur ihre `species_internal_id`.

## 4. Combat Orientation bewusst klein halten

Für eine frühe Zuchtzielwahl reichen:

- Elemente;
- Base-Stats der Art;
- IVs/Talente der konkreten persönlichen Instanz;
- gewünschte Passiven;
- Breeding-Erreichbarkeit;
- persönlicher Bestand.

Beispiel:

```text
"Ich möchte ein starkes Feuer-Pal breeden."

Elementfilter
→ Species-Base-Stats
→ mögliche Zielarten
→ persönlicher Bestand
→ Breeding-Routen
→ Reasoning-Modell erklärt valide Trade-offs
```

Der Planner darf daraus Orientierung ableiten, aber keinen vollständigen realen DPS-Wert behaupten.

## 5. Terminologie strikt trennen

### Passive Skills

Echte Pal-Passiven, die als eigene Domain behandelt werden. Sie dürfen nicht mit der Partnerfähigkeit verwechselt werden.

### Partner Skills

Artgebundene Partnerfähigkeit eines Pals. Ein Partner Skill kann Mobility oder andere Funktionen beeinflussen. Seine Wirkung wird nur aus validierten Daten übernommen.

### Species Base Capability

Artbezogene Grundeigenschaft wie Element, Base-Stat oder extrahierbarer Movement-Grundwert.

### Derived Planner Evaluation

Vom Planner aus validierten Fakten abgeleitete Orientierung. Sie ist keine kanonische Spielwahrheit.

## 6. Mobility Orientation

Mobility ist eine sinnvolle spätere Capability-Domain, weil sie die Wahl eines Zuchtziels direkt beeinflussen kann.

Typische Fragen:

- Welches Flugmount lohnt sich mit meinem Bestand?
- Welche schnelle Mount-Art kann ich mit möglichst wenig neuen Pals breeden?
- Welche Route kombiniert gute Mobility mit meinen gewünschten Passiven?
- Wie verändert eine validierte Partnerfähigkeit die Mobility?

### Harte Mobility-Fakten

Mögliche Felder, sofern reproduzierbar extrahierbar:

```text
mobility_base
- traversal_modes[]
- normal_speed
- sprint_speed
- flight_speed
- water_speed
- stamina_related_base_data
- jump_capabilities
- source_build
- provenance
```

Feldnamen und Einheiten werden erst nach einem Data-Core-Audit festgelegt.

## 7. Effektquellen getrennt speichern

Ein effektiver Mobility-Wert kann mehrere Quellen besitzen. Diese Quellen dürfen nicht zu einem undurchsichtigen Endwert zusammenfallen.

Konzeptionell:

```text
mobility_effect
- effect_id
- source_type
  - species_base
  - passive_skill
  - partner_skill
  - condensation_scaling
  - mounted_effect
  - team_condition
  - validated_special_rule
- source_id
- effect_type
  - movement_speed
  - sprint_speed
  - flight_speed
  - water_speed
  - stamina
  - jump
  - double_jump
  - traversal_mode
- operation
  - add
  - multiply
  - override
  - enable
  - disable
- value
- condition{}
- source_build
- provenance
```

Wichtig ist die Trennung zwischen Grundwert, Multiplikator, Override und freigeschalteter Fähigkeit.

## 8. Bedingungen

Mögliche Condition-Typen, sofern später fachlich belegt:

```text
condition
- mounted
- flying
- sprinting
- condensation_level
- team_contains_element
- team_contains_species_class
- team_count
- partner_skill_active
- other_validated_condition
```

Das Schema beschreibt nur die Struktur. Es behauptet noch nicht, welche konkrete Art welche Bedingung besitzt.

## 9. Partnerfähigkeiten als Capability-Quelle

Partnerfähigkeiten können Mobility direkt verändern und müssen deshalb strukturiert auswertbar sein.

Konzeptionell:

```text
partner_skill_effect
- partner_skill_id
- effect_domain
- effect_type
- effect_value_or_scaling
- condition{}
- condensation_scaling{}
- source_build
- provenance
```

Für einen ersten Mobility-Ausbau werden ausschließlich validierte Mobility-relevante Effekte genutzt.

Combat-relevante Effekte können im Data Core vorhanden sein, ohne dass Breeder AI daraus bereits ein vollständiges Kampfranking erstellt.

## 10. Qualitative Mount-Faktoren

Nicht jeder praktische Mount-Faktor ist sauber als Zahl darstellbar.

Später denkbare Hinweise:

- sehr großes Modell;
- eingeschränkte Sicht beim berittenen Kampf;
- ungewöhnliches Handling;
- besondere Relation zwischen Normal- und Sprintgeschwindigkeit;
- besondere Sprung-/Traversal-Funktion.

Solche Faktoren dürfen nicht ungeprüft als objektiver Score codiert werden. Sie brauchen eine definierte Quelle und müssen klar von subjektiver Bewertung getrennt bleiben.

Ein hoher Speed-Wert allein darf nicht automatisch zu `bestes Mount` führen.

## 11. Candidate Regression Cases

Aus der Produktdiskussion gibt es Klassen von Sonderfällen, die später gezielt gegen die Extraktion getestet werden sollen:

1. Art/Form mit abweichendem effektivem Mobility-Wert gegenüber einer verwandten Art;
2. Partnerfähigkeit mit Speed-/Flight-Speed-Skalierung;
3. Mobility-Effekt, der über Kondensation verändert wird;
4. besondere Relation zwischen Normal- und Sprintgeschwindigkeit;
5. Mounted Double Jump oder andere Traversal-Funktion;
6. teamabhängiger Mobility-Effekt;
7. nominell starke Mobility-Werte, aber praktische Einschränkung durch Größe/Sicht/Handling.

In der Produktdiskussion wurden Aydrolon, Elphidran Aqua, Xenolord und Pantalus als mögliche spätere Prüfkandidaten genannt. Diese Namen sind **keine Bestätigung einer konkreten Mechanik oder Zahl**. Ein späterer Data-Core-Auftrag muss die jeweiligen Annahmen am aktuellen Build bestätigen oder verwerfen.

## 12. Showcase-Nutzen ohne Kopie

Der spätere dynamische Showcase kann Species-Capabilities live referenzieren:

```text
showcase_entry
→ pal_instance
→ species_internal_id
→ species_capability_summary
```

Dadurch können später beispielsweise Elemente, Base-Stats und validierte Mobility-Grunddaten angezeigt werden, ohne sie in jedem Showcase-Datensatz zu duplizieren.

## 13. Data-Core-Prioritäten

### Stufe A – hoher früher Planner-Nutzen

- Species-Elemente;
- Species-Base-Stats;
- Partner-Skill-Identität;
- Build-Provenienz.

### Stufe B – Mobility

- Movement-/Flight-/Sprint-/Water-Grundwerte;
- Traversal-Modi;
- Partner-Skill-Effekte auf Mobility;
- Kondensationsskalierung relevanter Effekte;
- besondere Mobility-Regeln, sofern strukturiert extrahierbar.

### Stufe C – spätere Capability-Domains

Nur wenn ein echter Planner-Anwendungsfall vorhanden ist.

## 14. Update- und Provenienzregeln

Jede Capability-Domain braucht mindestens:

```text
source_build
extraction_source
schema_version
validated_at
provenance
```

Langfristiges Ziel:

```text
neuer Palworld-Build
→ Technical Core neu extrahieren
→ Capability Candidate erzeugen
→ Diff gegen vorherigen Build
→ Regression Cases ausführen
→ Review
→ validierte Domain veröffentlichen
```

Die Capability-Schicht soll nicht nach jedem Patch durch manuelles Zusammensuchen alter Community-Werte gepflegt werden müssen, wenn eine reproduzierbare Extraktion möglich ist.

## 15. Reasoning vs. Wahrheit

Für Species und Mobility gilt:

```text
Reasoning LLM
= Semantik, Rückfragen, Vergleich, Trade-offs, Erklärung

Resolver / Data Core
= Existenz, IDs, Werte, Wirkungen, Bedingungen

Planner
= systematische Kandidaten- und Routenberechnung
```

Beispiel:

```text
"Welches schnelle Mount würdest du nehmen?"
```

Das Reasoning-Modell darf bewerten. Die Mobility-Werte selbst müssen aus validierten Daten kommen.

## 16. Feedback-Signale

Mögliche strukturierte Improvement-/Fehlersignale:

```text
CAPABILITY_DATA_MISSING
MOBILITY_RULE_AMBIGUOUS
PARTNER_SKILL_EFFECT_UNRESOLVED
MOBILITY_END_VALUE_UNKNOWN
```

Häufige Signale können später zeigen, dass eine zusätzliche deterministische Zwischenstufe benötigt wird.

## 17. Tests

Vor produktiver Nutzung mindestens:

- Element-IDs referenzieren nur kanonische Entities;
- Base-Stats sind buildbezogen;
- persönliche IVs werden nicht mit Species-Base-Werten vermischt;
- Base-Wert und Effektquelle bleiben getrennt;
- Overrides werden nicht als Multiplikatoren behandelt;
- Bedingungen greifen nur, wenn sie erfüllt sind;
- Kondensationsskalierung wird nur bei validierter Regel angewendet;
- unbekannte Sonderregel erzeugt keinen geratenen Endwert;
- Candidate Regression Cases werden gegen aktuellen Build geprüft.

## 18. Phasen

### C0 – Schema-/Extraktionsaudit

Prüfen, welche Species-/Mobility-Daten bereits vorhanden oder reproduzierbar extrahierbar sind.

### C1 – Species Orientation

Elemente, Base-Stats, Species-Vergleich. Kein Damage-Simulator.

### C2 – Mobility Orientation

Harte Mobility-Basiswerte, Partner-Skill-/Kondensations-Effekte, Sonderregeln und Regressionstests.

Weitere Domains nur nach realem Planner-Bedarf.

## 19. Stopppunkte

Review ist erforderlich, wenn:

- ein Effekt nur über Pal-spezifische Hardcodes reproduzierbar scheint;
- Quelle oder Buildbezug unklar ist;
- eine Mobility-Berechnung nur durch geratenes Verhalten vollständig wird;
- die Erweiterung in Richtung vollständiger Combat-/Build-Simulation abdriftet.

## 20. Aktueller Konsens

- Breeder AI bleibt primär Breeding-/Planner-Tool;
- Elements + Base-Stats sind sinnvolle Zielwahl-Daten;
- vollständige Combat-Simulation bleibt draußen;
- Mobility wird vorbereitet;
- Partnerfähigkeiten und echte Passiven bleiben strikt getrennt;
- Effektquellen bleiben getrennt vom Base-Wert;
- Sonderregeln brauchen Provenienz und Regressionstests;
- der Showcase referenziert Daten live statt sie zu kopieren;
- neue Capability-Domains werden nur bei echtem Planner-Nutzen ergänzt.