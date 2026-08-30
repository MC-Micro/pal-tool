# Kanonische Palworld-Zuchtreferenz

Stand: Schema-5-Mechanik und veröffentlichter 299-Pal-Produktumfang, vollständig gegen den normalisierten offiziellen Dedicated-Server-Build `24575149` für Palworld `1.0.3` geprüft.

## Verbindlicher Einsatz

Vor jeder Zuchtberechnung werden zuerst `breeding_rules.json`, danach `special_combinations.json` und anschließend `pal_values.json` verwendet. Eine Rechnung allein anhand von Paldeck-Nummern oder alten Internettabellen ist nicht zulässig.

## Dateien

- `pal_values.json` / `.csv`: der veröffentlichte Produktumfang mit offiziellen CombiRanks, Seltenheiten, IgnoreCombi, CombiDuplicatePriority und `sourceOrdinal` als interner Reihenfolge.
- `special_combinations.json` / `.csv`: sämtliche für den Produktumfang relevanten artverschiedenen Einträge aus der offiziellen aktuellen Sonderzuchttabelle, einschließlich möglicher Geschlechtsvorgaben.
- `duplicate_rank_groups.json`: alle normalen Kind-Kandidaten, die exakt denselben CombiRank teilen.
- `breeding_rules.json`: vollständige verbindliche Entscheidungsreihenfolge, globale Gleichart-Regel und verifizierte Tie-Break-Fälle.
- `manifest.json`: Quellen, Commit-Pins, Hashes, Zähler und sämtliche Validierungsabweichungen.

## Verbindliche Kurzregel

1. Gleiche Pal-Art + gleiche Pal-Art ergibt dieselbe Pal-Art.
2. Danach direkte Spezialkombination einschließlich Geschlechtsvorgabe prüfen.
3. Andernfalls nur normale Kind-Kandidaten verwenden: `CombiRank > 0`, `IgnoreCombi = false` und die Art kommt nicht als `child_internal` in `special_combinations.json` vor. Der Spezialkind-Ausschluss gilt nicht für die vorrangige Same-Species-Regel.
4. Zielwert `floor((A + B + 1) / 2)` bilden; bei den aktuellen durch zehn teilbaren Werten ist das exakt der Mittelwert.
5. Kleinsten CombiRank-Abstand wählen.
6. Bei gleich weit entfernten Kandidaten gewinnt die höhere `CombiDuplicatePriority`. Rarity beziehungsweise Seltenheit der Eltern oder Kinder ist kein Zucht-Tie-Breaker.
7. Bei weiterem Gleichstand: Nicht-Variante vor Variante, danach niedrigere interne Reihenfolge.

## Validierung

- Pals: **299**
- Artverschiedene direkte Spezialkombinationen: **136**
- Eindeutige Spezialkind-Arten: **90**
- Zulässige normale Formel-Kinder: **184**
- Durch die Spezialkindregel geänderte ungeordnete Paarergebnisse: **13.479 von 44.850**
- Gruppen mit identischem Rang: **1**
- Fehlende direkte Spieldatenzeilen: **0**
- Abweichende Zuchtwerte gegenüber PalCalc: **0**
- Abweichende Seltenheiten gegenüber PalCalc: **0**
- Nicht aufgelöste direkte Spezialkombinationen: **0**
- Nicht durch zehn teilbare aktuelle CombiRanks: **0**

Details und jede Restunsicherheit stehen ausdrücklich in `breeding_rules.json` und `manifest.json`.

Der technische Candidate aus Steam App `2394010`, Build `24575149`, enthält 753 eindeutige Pal-Zeilen und 258 technische Sonderzuchtzeilen. Die beiden offiziellen Pal-Parametertabellen stimmen vollständig überein. Das read-only Review fand für 299 veröffentlichte Pals und 136 veröffentlichte artverschiedene Specials keine Quellkonflikte, Feldabweichungen, fehlenden oder neuen Kombinationen. Die technische Snapshot-SHA-256 lautet `78b598e7a4745f11061411ed0c976fac4e06d21ee9d9bb3002a0e90324b827cc`.

Die Terraria-Crossover-Entitäten ohne offiziellen `ZukanIndex` verwenden `paldex_no: null`; frühere künstliche 10000er Nummern sind keine Game Truth. Der offizielle aktuelle Lokalisierungseintrag `ElecSnail_Ground` lautet in Englisch und Deutsch `Snock Terra`.

## Direkte Ingame-Bestätigung und Auswirkungen

Am 13.07.2026 bestätigten ausgebrütete Eier in Palworld 1.0 `Lunaris MALE + Grintale FEMALE → Penking` sowie `Sibelyx + Lamball → Surfent`. Diese Tests bleiben historische direkte Regelbelege; der aktuelle Datenstand stammt aus dem offiziellen Build. Palworld.gg wurde nur manuell und nicht-kanonisch gegengeprüft; weder Build noch Worker hängen davon ab.

`Braloha + Dynamoff → Quivern` ist eine zusätzliche Ausschlussregression: Das gleich weit entfernte `Azurobe Cryst` ist ein Special-Child und darf deshalb gar nicht erst am normalen Priority-Vergleich teilnehmen.

Die globale Regel korrigiert auch ältere Beispielrouten: `Anubis + Eikthyrdeer Terra` ergibt jetzt `Bakemi`, nicht `Kingpaca Cryst`. `Kingpaca Cryst + Jolthog → Elphidran` sowie die direkte Spezialkombination `Elphidran + Surfent → Elphidran Aqua` bleiben gültig. Der vollständige maschinenlesbare Vergleich wird mit der API-Referenz als `generated/special-child-impact.json` erzeugt.
