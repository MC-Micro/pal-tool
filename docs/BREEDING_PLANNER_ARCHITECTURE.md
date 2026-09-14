# Breeding Planner – bestandsoptimierte Architektur

**Stand:** 14. September 2026  
**Status:** Zielarchitektur; der aktuelle öffentliche Breeder bleibt unverändert read-only/stateless

> Die konkrete Multi-User-, PWA-, Sprach-, Auth-, Inventory- und Mutation-Architektur steht in [`BREEDER_AI_PWA_ARCHITECTURE.md`](BREEDER_AI_PWA_ARCHITECTURE.md). Dieses Dokument beschreibt die fachliche Planner-Grenze.

## Ziel

Der heutige Breeder löst Arten- und Zuchtrouten aus allgemeiner Spielwahrheit. Eine Planner-Schicht soll zusätzlich privaten, nutzerspezifischen Player State berücksichtigen:

- vorhandene konkrete Pal-Exemplare;
- Geschlechter;
- vollständige Passiven;
- IVs/Talente;
- Varianten/Formen wie Lucky oder Alpha, sofern aktuell validiert;
- Kondensations-/Sternezustand;
- Keeper-Schutz;
- vorhandene Materialkopien;
- vorhandene Zwischenprodukte;
- Wiederverwendbarkeit wertvoller Träger.

Damit kann der Planner eine theoretisch kurze Artenroute gegen eine praktisch bessere bestandsoptimierte Route abwägen.

## Kanonische Quellen und Runtime-State

Die Verantwortlichkeiten bleiben getrennt:

- allgemeine Game Truth und Breeding Engine: `MC-Micro/pal-tool`;
- persönlicher Multi-User-Runtime-State der geplanten PWA: private authentifizierte Runtime-Persistenz, nicht Git;
- `MC-Micro/pal-vault`: private Kontinuitäts- und Backupquelle für ausdrücklich dort gespeicherte persönliche Projekte, aber keine verpflichtende Runtime-Abhängigkeit für fremde PWA-Nutzer.

Der geplante Friends-&-Family-Planner darf also nicht voraussetzen, dass jeder Nutzer eine Datei oder einen Bereich im Vault besitzt. Jeder Nutzer verwaltet seinen eigenen Bestand in der Anwendung.

`pal-tool` bleibt für Build, Tests und öffentliche Runtime unabhängig von privaten Repositories.

## Bevorzugte Runtime-Struktur

```text
                Pal Data Core
                     │
                     ▼
          öffentliche Breeding Engine
          / read-only Breeder-MCP
                     │
                     ▼
              Planner Engine
                ▲          ▲
                │          │
        User Inventory    Nutzerziel/
        private Runtime   Prioritäten
                │
                ▼
        authentifizierte PWA
```

Der öffentliche Breeder erhält keinen privaten Nutzerzustand.

## Öffentlicher Breeder

Die bestehenden fünf öffentlichen Tools bleiben ohne privaten Zustand:

- `breeding_status`
- `breeding_pair`
- `breeding_parents`
- `breeding_children`
- `breeding_route`

Der anonyme öffentliche MCP darf niemals private Player-State-Daten lesen oder zurückgeben und erhält keine schreibenden Funktionen.

## Planner-Oberflächen

Der Planner kann später intern beziehungsweise hinter Authentifizierung Funktionen anbieten wie:

- persönlichen Bestandsstatus;
- bestandsoptimierte Route zu einem Ziel-Pal;
- Passiv-Transfer-Plan;
- IV-/Talent-Transfer-Plan;
- kombinierter Arten-/Passiv-/IV-Plan;
- Kondensations-/Sterneplan;
- Materialbedarf zu einem vorhandenen Keeper-Pal.

Die endgültigen öffentlichen beziehungsweise internen Toolnamen und Schemas werden erst mit der Implementierung festgelegt.

## Sicherheitsprinzip

Der öffentliche MCP und der persönliche Planner müssen logisch und authentifizierungsseitig getrennt bleiben.

Verbindlich:

- der Breeder bleibt read-only;
- der persönliche Bestand wird niemals anonym exponiert;
- Nutzeridentität kommt aus einem serverseitig validierten Auth-Kontext;
- ein LLM darf keine `user_id` festlegen;
- ein LLM darf keine kanonischen Entity-IDs erfinden;
- ein LLM erzeugt nur typisierte Intent-/Mutation-Entwürfe;
- Bestandswrites laufen ausschließlich über eine validierende Mutation Engine;
- Keeper-Pals dürfen nicht automatisch als Material eingeplant werden;
- persönliche Bestände werden nicht ins öffentliche Repository committed.

## Planner-Auswertung

Eine praktische Route muss mindestens getrennt bewerten:

1. Artenroute und Specials;
2. erforderliche Geschlechter;
3. vorhandene konkrete Eltern und Zwischenprodukte;
4. gewünschte und unerwünschte Passiven;
5. IVs/Talente;
6. Varianten/Formen;
7. Kondensations-/Sternezustand;
8. Keeper-Schutz;
9. vorhandene Materialkopien;
10. spätere Wiederverwendbarkeit der Linie;
11. Beschaffbarkeit fehlender Arten nur aus validierten Daten oder expliziten Nutzerangaben.

Die Engine darf keine unbestätigten Wahrscheinlichkeiten, Eiermengen, Materialregeln oder Beschaffungsbewertungen erfinden.

## Trennung von Berechnung und KI-Bewertung

Die gewünschte Intelligenz entsteht hybrid:

1. Der Breeder liefert ausschließlich reale Paarungen und Artenrouten.
2. Die Planner Engine reichert Kandidaten mit dem persönlichen Bestand an und kann deterministisch vorbewerten.
3. Das LLM darf die validierten Kandidaten anhand der Nutzerprioritäten vergleichen und verständlich erklären.

Das LLM darf nicht selbst behaupten, eine Paarung sei gültig, wenn sie nicht aus der Breeding Engine stammt.

Eine zusätzliche Generation ist akzeptabel, wenn dadurch beispielsweise bereits vorhandene Passivträger genutzt, weniger neue Pals benötigt oder wichtige Zwischenprodukte wiederverwendet werden können.

## Persönlicher Bestand

Der persönliche Bestand soll nicht als vollständige Palbox-Pflicht entstehen, sondern organisch aus relevanten Pals:

- wertvolle Passivträger;
- IV-/Talentträger;
- blanke/saubere Pals;
- Lucky-/Alpha-/andere validierte Varianten;
- wichtige Arten;
- bereits gezüchtete Zwischenprodukte;
- Keeper;
- kondensierte Ziel-Pals;
- Material-/Duplikatpools.

Die bevorzugte Eingabe ist natürliche Sprache oder eine einfache UI. Sprache wird zuerst interpretiert, dann gegen kanonische Entities aufgelöst und erst danach als kontrollierte Mutation geschrieben.

Details zum Datenmodell und Schreibworkflow stehen in der PWA-Architektur.

## Kondensationsplanung

Der Planner soll einen vorhandenen Keeper als Zielobjekt behandeln können und getrennt berechnen:

- aktuelle Sterne/Kondensationsstufe;
- Zielstufe;
- bereits vorhandene Materialkopien;
- fehlende Materialeinheiten;
- gegebenenfalls bereits kondensierte Material-Pals nach aktuell validierter Regel.

Die dafür benötigten Stufenkosten dürfen nicht dauerhaft nur in einem Prompt hinterlegt werden. Sie müssen in einem patchvalidierten Regelmodul liegen.

## Mehrsprachige Entity-Auflösung

Planner-State speichert stabile interne IDs. Deutsche und englische Namen sowie Aliasse sind Eingabe-/Anzeigeebene.

Damit können Nutzer auf Deutsch oder Englisch sprechen, ohne dass zwei verschiedene Bestandsidentitäten derselben Art oder Passive entstehen.

Bei Mehrdeutigkeit wird nachgefragt statt geraten.

## Multi-Device und Persistenz

Der persönliche Serverzustand ist autoritativ. Ein Gerät, Browser oder eine installierte PWA ist nur ein Client.

Gerätewechsel, Neuinstallation oder Sessionverlust dürfen keinen neuen Bestand erzeugen. Nach erneuter Authentifizierung muss dieselbe interne Nutzer-ID und derselbe Bestand geladen werden.

Lokaler Browser-Storage dient höchstens als Cache oder Entwurfsfläche.

## Aktueller Stopppunkt und nächster technischer Schritt

Der öffentliche Breeder und Data Core bleiben zunächst unverändert.

Die neue Planner/PWA-Arbeit beginnt separat mit:

1. einem Auth-/Identity-Spike;
2. einem minimalen privaten User-State-Schema;
3. Cross-Tenant-Isolationstests;
4. danach Text-Inventory und Entity Resolver;
5. erst anschließend Sprache und inventory-aware Planner.

Es gibt bis zu einem separat freigegebenen Implementierungs-PR keine neue Runtime, Datenbank, Access-Policy, API, MCP-Funktion oder Deploymentfolge.
