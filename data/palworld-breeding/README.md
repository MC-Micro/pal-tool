# Kanonische Palworld-Zuchtreferenz

Stand: automatisch erzeugter und quellenübergreifend validierter Palworld-1.0-Datensnapshot.

## Verbindlicher Einsatz

Vor jeder Zuchtberechnung werden zuerst `breeding_rules.json`, danach `special_combinations.json` und anschließend `pal_values.json` verwendet. Eine Rechnung allein anhand von Paldeck-Nummern oder alten Internettabellen ist nicht zulässig.

## Dateien

- `pal_values.json` / `.csv`: alle aktuellen Pals mit CombiRank, Seltenheit, IgnoreCombi, CombiDuplicatePriority und interner Reihenfolge.
- `special_combinations.json` / `.csv`: sämtliche quellenübergreifend rekonstruierten artverschiedenen Spezialpaarungen, die die normale Werteformel überschreiben.
- `duplicate_rank_groups.json`: alle normalen Kind-Kandidaten, die exakt denselben CombiRank teilen.
- `breeding_rules.json`: vollständige verbindliche Entscheidungsreihenfolge, globale Gleichart-Regel und verifizierte Tie-Break-Fälle.
- `manifest.json`: Quellen, Commit-Pins, Hashes, Zähler und sämtliche Validierungsabweichungen.

## Verbindliche Kurzregel

1. Gleiche Pal-Art + gleiche Pal-Art ergibt dieselbe Pal-Art.
2. Danach Spezialkombination einschließlich möglicher Geschlechtsvorgabe prüfen.
3. Andernfalls nur normale Kind-Kandidaten (`IgnoreCombi = false`) verwenden.
4. Zielwert `floor((A + B + 1) / 2)` bilden; bei den aktuellen durch zehn teilbaren Werten ist das exakt der Mittelwert.
5. Kleinsten CombiRank-Abstand wählen.
6. Bei gleich weit entfernten unterschiedlichen Rängen: Kind-Seltenheit möglichst nah am Seltenheitsdurchschnitt der Eltern; danach niedrigere Seltenheit.
7. Bei exakt identischem Kind-Rang: höhere `CombiDuplicatePriority`, dann Nicht-Variante, dann niedrigere interne Reihenfolge.

## Validierung

- Pals: **299**
- Artverschiedene Spezialkombinationen: **791**
- Spezialkinder außerhalb des normalen Kandidatenpools: **116**
- Gruppen mit identischem Rang: **1**
- Abweichende CombiRanks zwischen den unabhängigen Quellen: **0**
- Abweichende Seltenheiten zwischen den unabhängigen Quellen: **0**
- Nicht durch zehn teilbare aktuelle CombiRanks: **0**

Details und jede Restunsicherheit stehen ausdrücklich in `breeding_rules.json` und `manifest.json`.
