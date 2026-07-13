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
3. Andernfalls nur normale Kind-Kandidaten verwenden: `CombiRank > 0`, `IgnoreCombi = false` und die Art kommt nicht als `child_internal` in `special_combinations.json` vor. Der Spezialkind-Ausschluss gilt nicht für die vorrangige Same-Species-Regel.
4. Zielwert `floor((A + B + 1) / 2)` bilden; bei den aktuellen durch zehn teilbaren Werten ist das exakt der Mittelwert.
5. Kleinsten CombiRank-Abstand wählen.
6. Bei gleich weit entfernten unterschiedlichen Rängen: Kind-Seltenheit möglichst nah am Seltenheitsdurchschnitt der Eltern; danach niedrigere Seltenheit; bleibt der Cross-Rank-Gleichstand vollständig bestehen, gewinnt der höhere `CombiRank`.
7. Bei exakt identischem Kind-Rang separat: höhere `CombiDuplicatePriority`, dann Nicht-Variante, dann niedrigere interne Reihenfolge.

## Validierung

- Pals: **299**
- Artverschiedene direkte Spezialkombinationen: **136**
- Eindeutige Spezialkind-Arten: **90**
- Zulässige normale Formel-Kinder: **184**
- Durch die Spezialkindregel geänderte ungeordnete Paarergebnisse: **13.785 von 44.850**
- Gruppen mit identischem Rang: **1**
- Fehlende direkte Spieldatenzeilen: **0**
- Abweichende Zuchtwerte gegenüber PalCalc: **0**
- Abweichende Seltenheiten gegenüber PalCalc: **0**
- Nicht aufgelöste direkte Spezialkombinationen: **0**
- Nicht durch zehn teilbare aktuelle CombiRanks: **0**

Details und jede Restunsicherheit stehen ausdrücklich in `breeding_rules.json` und `manifest.json`.

## Direkte Ingame-Bestätigung und Auswirkungen

Am 13.07.2026 bestätigten ausgebrütete Eier in Palworld 1.0 `Lunaris MALE + Grintale FEMALE → Penking` sowie `Sibelyx + Lamball → Surfent`. Der erste Test bestätigt den globalen Higher-CombiRank-Tie-Break, der zweite den globalen Spezialkind-Ausschluss. Palworld.gg wurde nur manuell und nicht-kanonisch gegengeprüft; weder Build noch Worker hängen davon ab.

Die globale Regel korrigiert auch ältere Beispielrouten: `Anubis + Eikthyrdeer Terra` ergibt jetzt `Bakemi`, nicht `Kingpaca Cryst`. `Kingpaca Cryst + Jolthog → Elphidran` sowie die direkte Spezialkombination `Elphidran + Surfent → Elphidran Aqua` bleiben gültig. Der vollständige maschinenlesbare Vergleich wird mit der API-Referenz als `generated/special-child-impact.json` erzeugt.
