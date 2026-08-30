# Pal Data Core – Dynamic Roadmap

**Stand:** 30. August 2026  
**Ziel:** Breeder zuerst produktionsreif abschließen; weitere Core-Domänen danach modular ausbauen, ohne die aktuelle PAK-Acquisition oder den Technical Snapshot neu zu erfinden.

## Statuslegende

- `done` – fachlich revalidiert, getestet und für den aktuellen Build freigegeben.
- `extracted_unmodeled` – technische Rohdaten werden bereits im aktuellen Snapshot erfasst, aber noch nicht als kanonische Fachdomäne veröffentlicht.
- `inventory_only` – Tabelle/Felder werden strukturell inventarisiert; Semantik ist noch nicht freigegeben.
- `planned` – klarer nächster Arbeitsblock.
- `blocked` – benötigt zusätzliche Evidenz, Clientdaten oder eine separate Sicherheits-/Produktentscheidung.

## P0 – Breeder wieder normal nutzbar

**Status:** `done` auf Feature-Branch / Review und Merge/Deploy noch offen.

Aktueller Referenzstand:

- Palworld `1.0.3`;
- offizieller Dedicated-Server-Build `24575149`;
- 299 reviewte Produkt-Pals;
- 753 technische Pal-Zeilen im Core;
- 258 technische `DT_PalCombiUnique`-Zeilen vollständig klassifiziert;
- 115 veröffentlichte Same-Species-Identitäten;
- 136 veröffentlichte Cross-Species-Specials;
- 7 technische Same-Species-Identitäten außerhalb des Produktfilters;
- 0 technische Cross-Species-Zeilen außerhalb des Produktfilters;
- Release-/Determinismus-/API-/Data-Core-Gates grün.

Verbindliche Resolver-Reihenfolge:

1. Same Species;
2. direkte Spezialkombination einschließlich Geschlecht;
3. zulässiger normaler Kandidatenpool;
4. Zielwert;
5. kleinster Rangabstand;
6. höhere `CombiDuplicatePriority`;
7. Nicht-Variante vor Variante;
8. offizielle Tabellenreihenfolge (`sourceOrdinal`), im bestehenden Kompatibilitätsdatensatz als `internal_index` gespiegelt.

Vor Produktion verbleiben nur Review, Merge und Deployment als separate Freigabeentscheidungen.

## P1 – Automatischer Build-/Freshness-Refresh

**Status:** `planned` nach Breeder-Merge.

Ziel:

- billiger Build-ID-Check vor jedem großen Download;
- bei unverändertem Build sofort beenden;
- bei neuem Build Technical Snapshot + Field Inventory erzeugen;
- Tabellen-/Feld-/Typ-Diff erstellen;
- unbekannte strukturelle Änderungen als Review-Blocker behandeln;
- letzten akzeptierten Datenstand bei Fehlern nicht überschreiben;
- optional Draft-PR statt automatischem Merge erzeugen.

## P2 – Pal-Identitäten / Crosswalks

**Status:** `extracted_unmodeled`.

Bereits technisch vorhanden sind unter anderem `Tribe`, `BPClass`, `ZukanIndex`, `ZukanIndexSuffix`, Boss-/Raid-/Tower-/Predatorflags und Namensreferenzen.

Offen:

- stabile öffentliche Core-ID-Regeln;
- Formen/Varianten/Boss-/technische Zeilen sauber klassifizieren;
- Obtainable/Breedable/Playable als getrennte, belegte Dimensionen modellieren;
- keine Paldecknummer als technische Primär-ID missbrauchen.

## P3 – Stats

**Status:** `extracted_unmodeled`.

Bereits im aktuellen Technical Snapshot erfasst:

- `HP`;
- `MeleeAttack`;
- `ShotAttack`;
- `Defense`;
- `Support`;
- `CraftSpeed`;
- `Stamina`;
- `FoodAmount`;
- weitere Pal-Parameterfelder über die allgemeine Inventur.

Offen:

- Species-Basiswerte normalisieren;
- Level-/IV-/Seelen-/Condensation-/Alpha-/Bossmodifier strikt trennen;
- keine individuellen IVs in `pal-tool`; diese gehören in privaten Player State.

## P4 – Arbeitseignungen

**Status:** `extracted_unmodeled`.

Alle 13 aktuellen `WorkSuitability_*`-Felder werden bereits aus derselben Pal-Tabelle gelesen, einschließlich `OilExtraction`.

Offen:

- kanonisches Work-Schema;
- angeborene Eignung von Rangsteigerung, Arbeitsgeschwindigkeit, Passiven, Partnerfähigkeit und Basis-/Forschungsbonus trennen;
- DE/EN-Anzeigenamen und Produktansicht.

## P5 – Movement

**Status:** `extracted_unmodeled` für Tabellenrohwerte; zusätzliche Blueprint-Schicht `planned`.

Bereits erfasst:

- `SlowWalkSpeed`;
- `WalkSpeed`;
- `RunSpeed`;
- `RideSprintSpeed`;
- `TransportSpeed`;
- `SwimSpeed`;
- `SwimDashSpeed`.

Offen:

- Blueprint-Vererbung und direkte Overrides;
- Fly-/FlySprint-Fallbacks;
- MovementType und Reit-/Schwimm-/Hover-/Flugzustände;
- Partner-/Passivmodifier;
- keine universelle `speed`-Zahl oder unbelegte Endformel.

## P6 – Passiven

**Status:** `inventory_only` / Tabelle aktuell direkt lesbar.

Aktueller Build:

- `DT_PassiveSkill_Main`: 1905 Zeilen.

Offen:

- EffectTypes/-Values;
- Targets;
- Invoke-Kontexte;
- Stackability;
- World-Tree-/Mutation-/Partner-Sonderfälle;
- Lokalisierung;
- Wirkung auf Pal, Spieler, Reiten, Basis und Partnerfähigkeit strikt trennen.

## P7 – Partnerfähigkeiten

**Status:** `inventory_only` / Tabellen aktuell direkt lesbar.

Aktueller Build:

- `DT_PartnerSkill`: 50 Zeilen;
- `DT_PartnerSkillParameter`: 682 Zeilen.

Offen:

- Partner-Skill-ID, sichtbarer Text, Execution-Archetype, Active Skill, Passive Effects, Rank Values und Pal Gear als getrennte Ebenen verbinden;
- keine Stack- oder Rangwirkung aus Namen/Text allein ableiten.

## P8 – Items / Recipes / Technology / Localization

**Status:** `inventory_only`.

Aktuell direkt lesbar:

- Items: 2466;
- Rezepte: 1414;
- Technology Recipe Unlock: 588;
- Tech-Namen EN/DE: 835/835;
- Tech-Beschreibungen EN/DE: 587/587;
- Pal-Namen EN/DE: 322/322.

Offen:

- Item-, Recipe-, Technology-, BuildObject- und Pal-Gear-Entitäten sauber verbinden;
- Originalspieltext und kuratierte Korrekturen getrennt halten.

## P9 – Mutation / Breeding Item Effects / Game Settings

**Status:** `planned` / teilweise entdeckt.

Entdeckt sind unter anderem:

- `DA_BreedingItemEffectData`;
- `BP_PalGameSetting`.

Offen:

- tatsächliche aktuelle Mutation-/Itemmechanik extrahieren und testen;
- keine native Wahrscheinlichkeit erfinden;
- getrennt vom normalen Species-Resolver halten.

## P10 – Private Player State + Planner

**Status:** Player-State-Schema separat in `MC-Micro/pal-vault` vorbereitet; Planner-Runtime `planned`.

Ziel:

- öffentliche Game-/Mechanic-Truth aus `pal-tool`;
- private Pal-Instanzen aus `pal-vault`;
- inventory-/gender-/passive-/IV-aware Planner als private, authentifizierte Schicht;
- öffentlicher Breeder bleibt anonym, stateless und species-only.

Keine private GitHub-Liveabfrage aus dem öffentlichen MCP.

## P11 – PAL-Control Integration

**Status:** getrenntes Repository; nicht Teil des Breeder-Deployments.

`pal-control` darf später freigegebene Core-/Player-State-Versionen konsumieren, besitzt sie aber nicht kanonisch. Breeding-/Planner-Ergebnisse dürfen niemals automatisch Serveraktionen auslösen.

## Erweiterungsregel

Neue Palworld-Systeme werden zuerst über Discovery/Field Inventory sichtbar gemacht. Danach werden sie als neues Domain-/Extractorprofil ergänzt. Eine neue DataTable oder ein zusätzliches Feld darf nicht verlangen, Acquisition, SteamCMD-Download und PAK-Mounting neu zu bauen.

## Priorität nach Breeder-Produktionsfreigabe

1. Build-/Freshness-Automation härten;
2. Pal-Identitäten/Crosswalks;
3. Stats + Work, weil Rohfelder bereits im Snapshot vorhanden sind;
4. Movement-Rohmodell + Blueprint-Erweiterung;
5. Passiven + Partnerfähigkeiten;
6. Items/Recipes/Tech/Localization;
7. Mutation-/Breeding-Item-Sondermechaniken;
8. private Planner-Runtime.

Diese Reihenfolge ist dynamisch: neue Palworld-Patches oder konkrete Nutzerinteressen dürfen Prioritäten ändern, ohne bereits abgeschlossene Core-Schichten neu zu erfinden.
