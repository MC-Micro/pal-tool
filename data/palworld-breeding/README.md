# Kanonische Palworld-Zuchtreferenz

Stand: direkter, quellenübergreifend geprüfter Palworld-1.0-Spieldatensnapshot.

## Verbindlicher Einsatz

Vor jeder Zuchtberechnung werden zuerst `breeding_rules.json`, danach `special_combinations.json` und anschließend `pal_values.json` verwendet. Eine Rechnung allein anhand von Paldeck-Nummern oder alten Internettabellen ist nicht zulässig.

## Dateien

- `pal_values.json` / `.csv`: alle aktuellen Pals mit CombiRank, Seltenheit, IgnoreCombi, CombiDuplicatePriority und interner Reihenfolge.
- `special_combinations.json` / `.csv`: sämtliche artverschiedenen Einträge aus der direkten v1.0-Sonderzuchttabelle, einschließlich möglicher Geschlechtsvorgaben.
- `duplicate_rank_groups.json`: alle normalen Kind-Kandidaten, die exakt denselben CombiRank teilen.
- `breeding_rules.json`: vollständige verbindliche Entscheidungsreihenfolge, globale Gleichart-Regel und verifizierte Tie-Break-Fälle.
- `manifest.json`: Quellen, Commit-Pins, Hashes, Zähler und sämtliche Validierungsabweichungen.

## Verbindliche Kurzregel

1. Gleiche Pal-Art + gleiche Pal-Art ergibt dieselbe Pal-Art.
2. Danach direkte Spezialkombination einschließlich Geschlechtsvorgabe prüfen.
3. Andernfalls nur normale Kind-Kandidaten (`IgnoreCombi = false`) verwenden.
4. Zielwert `floor((A + B + 1) / 2)` bilden; bei den aktuellen durch zehn teilbaren Werten ist das exakt der Mittelwert.
5. Kleinsten CombiRank-Abstand wählen.
6. Bei gleich weit entfernten unterschiedlichen Rängen: Kind-Seltenheit möglichst nah am Seltenheitsdurchschnitt der Eltern; danach niedrigere Seltenheit.
7. Bei exakt identischem Kind-Rang: höhere `CombiDuplicatePriority`, dann Nicht-Variante, dann niedrigere interne Reihenfolge.

## Validierung

- Pals: **299**
- Artverschiedene direkte Spezialkombinationen: **136**
- Gruppen mit identischem Rang: **1**
- Fehlende direkte Spieldatenzeilen: **0**
- Abweichende Zuchtwerte gegenüber PalCalc: **0**
- Abweichende Seltenheiten gegenüber PalCalc: **0**
- Nicht aufgelöste direkte Spezialkombinationen: **0**
- Nicht durch zehn teilbare aktuelle CombiRanks: **0**

Details und jede Restunsicherheit stehen ausdrücklich in `breeding_rules.json` und `manifest.json`.
