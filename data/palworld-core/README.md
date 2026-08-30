# Palworld Data Core

Dieser Bereich wird die kanonische, buildbezogene allgemeine Palworld-Datenbasis von `MC-Micro/pal-tool`.

## Grundsatz

Der Core speichert allgemeine Spielwahrheit. Persönlicher Besitz, IVs/Talente konkreter Exemplare, persönliche Passivkombinationen und private Zuchtprojekte gehören nicht hierher.

## Quellenmodell

Primärquelle ist der jeweils geprüfte offizielle Palworld Dedicated Server. Community- und Drittquellen dienen nur als unabhängige Cross-Checks oder Interpretationshilfe.

Jeder akzeptierte Core-Stand muss seine Provenienz dokumentieren, insbesondere:

- Palworld-/Dedicated-Server-Build;
- Prüf-/Generierungszeitpunkt;
- Extraktorversion beziehungsweise Commit;
- CUE4Parse-Version;
- Mapping-Status und gegebenenfalls Mapping-Hash;
- verwendete Tabellen und Row-Counts;
- normalisierte Output-Hashes;
- bekannte Konflikte und Freshness-/Revalidierungsstatus.

## Technische Zeilen vor Produktansicht

Der Technical Core bewahrt alle relevanten technischen Zeilen, bevor Domain- oder Produktfilter greifen. Technische Existenz, Spielbarkeit, Fangbarkeit, Züchtbarkeit, Boss-/Raid-/Tower-/Predatorstatus und Variantenbezug sind getrennte Dimensionen.

## Domain-Trennung

Geplante beziehungsweise zu revalidierende Module:

- `entities` / Pal-Identitäten und Crosswalks;
- `pals`;
- `stats`;
- `work`;
- `movement`;
- `passives`;
- `partners`;
- `items`;
- `tech`;
- `breeding`;
- `manifest` / Provenienz und Status.

Die endgültigen Dateinamen und Schemas werden erst nach der aktuellen 1.0.3-Revalidierung gegen die echten Tabellen festgezogen.

## Breeder

Die buildabhängigen Zuchtfelder und die vollständige Unique-Combination-Tabelle gehören in den Core. Die fachliche Resolverregel bleibt in `data/palworld-breeding/breeding_rules.json`.

Bestehende `pal_values.json` und `special_combinations.json` sollen nach der Migration deterministisch aus dem Core erzeugt werden.
