# Kanonische Palworld-Zuchtreferenz

Stand: automatisch erzeugter 1.0-Datensnapshot.

## Dateien

- `pal_values.json` / `.csv`: alle aktuell gefilterten Pals mit CombiRank, Seltenheit, IgnoreCombi, CombiDuplicatePriority und interner Reihenfolge.
- `special_combinations.json` / `.csv`: alle Spezialpaarungen, die die normale Werteformel überschreiben.
- `duplicate_rank_groups.json`: alle normalen Kind-Kandidaten, die exakt denselben CombiRank teilen.
- `breeding_rules.json`: verbindliche Entscheidungsreihenfolge einschließlich Tie-Breaks.
- `manifest.json`: Quellen, Commit-Pins, Hashes und Validierungsbefund.

## Verbindliche Kurzregel

1. Spezialkombination prüfen.
2. Andernfalls Zielwert `floor((A + B) / 2)` bilden.
3. Nur `IgnoreCombi = false` als normale Kinder zulassen.
4. Kleinsten CombiRank-Abstand wählen.
5. Bei gleich weit entfernten Rängen: Seltenheit des Kindes möglichst nah am Seltenheitsdurchschnitt der Eltern; danach niedrigere Seltenheit.
6. Bei mehreren Pals mit exakt demselben Rang: `CombiDuplicatePriority`, danach stabile interne Reihenfolge.

## Validierung

- Pals: **299**
- Spezialkombinationen: **246**
- Gruppen mit identischem Rang: **1**
- Abweichende CombiRanks zwischen den beiden Quellen: **0**

Details und mögliche Restunsicherheiten stehen in `breeding_rules.json` und `manifest.json`.
