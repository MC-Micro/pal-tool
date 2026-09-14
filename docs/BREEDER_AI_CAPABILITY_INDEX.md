# Breeder AI PWA – Capability Index

**Stand:** 14. September 2026

Dieser Index ergänzt den bestehenden Breeder-AI-Handoff um die neu konkretisierten Planner-Capability-Domains.

## Verbindliche Lesereihenfolge

1. `BREEDER_AI_CURRENT_BLUEPRINT.md`
2. `BREEDER_AI_IMPLEMENTATION_ROADMAP.md`
3. `BREEDER_AI_SPECIES_MOBILITY_CAPABILITIES.md`
4. `BREEDER_AI_MODIFICATION_CAPABILITIES.md`
5. `BREEDER_AI_PWA_ARCHITECTURE.md`
6. `BREEDING_PLANNER_ARCHITECTURE.md`
7. `BREEDER_AI_SOCIAL_ARCHITECTURE.md`

Der `CURRENT_BLUEPRINT` bleibt die übergeordnete konzeptionelle Entscheidungswahrheit. Die beiden Capability-Dokumente erweitern ihn fachlich, ohne die bestehenden Architekturgrenzen zu ersetzen.

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

Konkrete Palwerte, Partnerfähigkeitswirkungen, Modulnamen, Kosten oder Sonderregeln werden aus diesen Architekturtexten **nicht** als Spielwahrheit übernommen.