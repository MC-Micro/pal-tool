# Breeder AI PWA – Capability Index

**Stand:** 14. September 2026

Dieser Index ergänzt den bestehenden Breeder-AI-Handoff um die neu konkretisierten Planner-Capability-Domains.

## Verbindliche Lesereihenfolge

1. `BREEDER_AI_CURRENT_BLUEPRINT.md`
2. `BREEDER_AI_IMPLEMENTATION_ROADMAP.md`
3. `BREEDER_AI_SPECIES_MOBILITY_CAPABILITIES.md`
4. `BREEDER_AI_MODIFICATION_CAPABILITIES.md`
5. `BREEDER_AI_IV_IMPROVEMENT_CAPABILITIES.md`
6. `BREEDER_AI_PWA_ARCHITECTURE.md`
7. `BREEDING_PLANNER_ARCHITECTURE.md`
8. `BREEDER_AI_SOCIAL_ARCHITECTURE.md`

Der `CURRENT_BLUEPRINT` bleibt die übergeordnete konzeptionelle Entscheidungswahrheit. Die Capability-Dokumente erweitern ihn fachlich, ohne die bestehenden Architekturgrenzen zu ersetzen.

## Neue Capability-Domains

### Species & Mobility

`BREEDER_AI_SPECIES_MOBILITY_CAPABILITIES.md`

Enthält:

- Species-Elemente und Base-Stats als sinnvolle Zielwahl-Daten;
- bewusste Grenze gegen einen vollständigen Combat-/DPS-Simulator;
- Mobility als spätere Planner-Domain;
- harte Trennung von Base-Wert, Partnerfähigkeit, echter Passive, Kondensation und Sonderregel;
- generisches Mobility-Effekt-/Condition-Modell;
- Build-Provenienz und Regression-Candidates;
- Data-Core-Audit-, Test- und Stopppunkte.

### Pal Modification

`BREEDER_AI_MODIFICATION_CAPABILITIES.md`

Enthält:

- Pure Breeding vs. Hybrid Breeding + validierter Pal-Modifikation;
- Capability Registry statt Pal-spezifischer Hardcodes;
- persönlicher Ressourcenstate pro `user_id` + `play_space_id`;
- Trennung von wiederverwendbaren und verbrauchbaren Ressourcen;
- `allow / ask / avoid / never` als Resource Protection Policy;
- Reasoning für Trade-offs, harte Business Rules für Wahrheit und Verbrauch;
- Tests, Data-Core-Audit, Phasen und Stopppunkte.

### IV/Talent Improvement

`BREEDER_AI_IV_IMPROVEMENT_CAPABILITIES.md`

Enthält:

- spätere Verbesserung von IVs/Talenten als ergänzenden Finish-Pfad zum Breeding;
- bewusst vorbereitete, aber standardmäßig deaktivierte Planner-Capability;
- Data-Core-/Build-Validierung von Fruchttypen, Statzuordnung, Delta, Caps und Restriktionen vor Aktivierung;
- persönlichen Ressourcenstate pro `user_id` + `play_space_id` erst bei späterer Aktivierung;
- dieselben `allow / ask / avoid / never`-Schutzprinzipien für knappe Consumables;
- klare Trennung zwischen reiner Breeding-Route und optionalem IV-/Talent-Finish;
- `DISABLED -> VALIDATION_ONLY -> AVAILABLE_AS_OPTION -> ACTIVE_IN_SCORING` als Aktivierungsstufen;
- Tests, Stopppunkte und ausdrückliches Review vor jeder aktiven Planner-Nutzung.

Die in der Produktdiskussion genannte Annahme eines festen Zuwachses pro Frucht wird lediglich als Validation Candidate geführt und nicht ohne Build-/Data-Core-Prüfung kanonisiert.

## Harte Produktgrenze

Diese Erweiterungen gehören nur deshalb in Breeder AI, weil sie Zuchtzielwahl oder Breeding-/Planner-Routen direkt beeinflussen.

Nicht Ziel dieses Ausbaupfads sind insbesondere:

- vollständige Damage-/DPS-Simulation;
- levelabhängige Endstats;
- Accessoire-/Zutraulichkeits-/Buff-Simulation;
- allgemeiner Palworld-Ressourcenmanager;
- vollständige Buildsimulation außerhalb des Breeding-/Planner-Kontexts.

## Implementierung

Die neuen Capability-Domains sollen die frühe Phase-0-/Phase-1-Implementierung nicht blockieren.

Ein späteres Coding-/Work-Modell soll zunächst die vorhandene Data-Core-Extraktion live auditieren und nur solche Capability-Felder kanonisieren, die buildbezogen, reproduzierbar und testbar sind.

Konkrete Palwerte, Partnerfähigkeitswirkungen, Modulnamen, Kosten, Fruchtwirkungen oder Sonderregeln werden aus diesen Architekturtexten **nicht** als Spielwahrheit übernommen.
